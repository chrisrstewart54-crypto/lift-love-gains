import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

webpush.setVapidDetails(
  "mailto:notifications@lift-love-gains.lovable.app",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Sub = {
  id: string; user_id: string; endpoint: string; p256dh: string; auth: string;
  notif_day: number; notif_hour: number; timezone: string; weight_unit: string; last_sent_week: string | null;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function localParts(tz: string, d = new Date()) {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, weekday: "short", hour: "numeric", hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit", minute: "2-digit",
    }).formatToParts(d);
  } catch {
    return localParts("UTC", d);
  }
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    day: DAYS.indexOf(g("weekday")), hour: Number(g("hour")), minute: Number(g("minute")),
    date: `${g("year")}-${g("month")}-${g("day")}`,
  };
}

function weekStartUtc(tz: string) {
  const now = new Date();
  const p = localParts(tz, now);
  const ms = ((p.day * 24 + p.hour) * 60 + p.minute) * 60000;
  const start = new Date(now.getTime() - ms);
  start.setUTCSeconds(0, 0);
  return start;
}

async function buildSummary(admin: ReturnType<typeof createClient>, userId: string, tz: string, unit: string) {
  const start = weekStartUtc(tz);
  const [{ data: logs }, { data: exercises }] = await Promise.all([
    admin.from("workout_logs").select("date, exercises").eq("user_id", userId),
    admin.from("exercises").select("id, name, equipment").eq("user_id", userId),
  ]);
  const exMap = new Map((exercises ?? []).map((e: any) => [e.id, e]));
  let count = 0; let volume = 0;
  const histMax: Record<string, number> = {}; const weekMax: Record<string, number> = {};
  for (const log of (logs ?? []) as any[]) {
    const inWeek = new Date(log.date) >= start;
    if (inWeek) count++;
    for (const ex of log.exercises ?? []) {
      const equip = String(exMap.get(ex.exerciseId)?.equipment ?? "").toLowerCase();
      const cardio = equip.includes("cardio");
      for (const s of ex.sets ?? []) {
        const w = Number(s.weight) || 0; const r = Number(s.reps) || 0;
        if (cardio) continue;
        const target = inWeek ? weekMax : histMax;
        if (!target[ex.exerciseId] || w > target[ex.exerciseId]) target[ex.exerciseId] = w;
        if (inWeek) volume += (equip === "dumbbell" ? 2 : 1) * w * r;
      }
    }
  }
  const prs = Object.entries(weekMax)
    .filter(([id, w]) => w > 0 && (!histMax[id] || w > histMax[id]))
    .map(([id]) => exMap.get(id)?.name).filter(Boolean);
  let body = `🏋️ ${count} workout${count === 1 ? "" : "s"}\n💪 ${Math.round(volume).toLocaleString()} ${unit} total volume`;
  if (prs.length) body += `\n🏆 New PRs: ${prs.join(", ")}`;
  return { count, body };
}

async function send(admin: ReturnType<typeof createClient>, sub: Sub, payload: object) {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
    );
    return true;
  } catch (e: any) {
    console.error("push failed", e?.statusCode, e?.body);
    if (e?.statusCode === 404 || e?.statusCode === 410) {
      await admin.from("push_subscriptions").delete().eq("id", sub.id);
    }
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  let body: any = {};
  try { body = await req.json(); } catch { /* cron may send empty */ }

  // Test mode: authenticated user sends a summary to their own devices now.
  if (body?.test === true) {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data, error } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (error || !data?.claims?.sub) return json({ error: "Not signed in" }, 401);
    const userId = data.claims.sub as string;
    const { data: subs } = await admin.from("push_subscriptions").select("*").eq("user_id", userId);
    if (!subs?.length) return json({ error: "No devices registered for push" }, 404);
    let sent = 0;
    for (const s of subs as Sub[]) {
      const { body: text } = await buildSummary(admin, userId, s.timezone, s.weight_unit);
      if (await send(admin, s, { title: "Weekly Workout Summary (test)", body: text })) sent++;
    }
    return json({ sent });
  }

  // Scheduled mode: send to everyone whose local day/hour matches, once per week.
  const { data: subs } = await admin.from("push_subscriptions").select("*");
  let sent = 0;
  for (const s of (subs ?? []) as Sub[]) {
    const p = localParts(s.timezone);
    if (p.day !== s.notif_day || p.hour !== s.notif_hour) continue;
    const weekKey = p.date;
    if (s.last_sent_week === weekKey) continue;
    const { count, body: text } = await buildSummary(admin, s.user_id, s.timezone, s.weight_unit);
    await admin.from("push_subscriptions").update({ last_sent_week: weekKey }).eq("id", s.id);
    if (count === 0) continue;
    if (await send(admin, s, { title: "Weekly Workout Summary", body: text })) sent++;
  }
  return json({ sent });
});
