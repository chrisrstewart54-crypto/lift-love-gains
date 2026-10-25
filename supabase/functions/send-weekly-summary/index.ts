import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const GMAIL_GATEWAY = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

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

type EmailPref = {
  id: string; user_id: string; notif_day: number; notif_hour: number;
  timezone: string; weight_unit: string; email_last_sent_week: string | null;
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

function summarizeText(count: number, volume: number, prs: string[], unit: string) {
  let body = `🏋️ ${count} workout${count === 1 ? "" : "s"}\n💪 ${Math.round(volume).toLocaleString()} ${unit} total volume`;
  if (prs.length) body += `\n🏆 New PRs: ${prs.join(", ")}`;
  return body;
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
    .map(([id]) => exMap.get(id)?.name).filter(Boolean) as string[];
  return { count, volume, prs };
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

function encodeB64Url(bytes: Uint8Array) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sendGmailEmail(to: string, subject: string, html: string) {
  const email = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "",
    html,
  ].join("\r\n");
  const res = await fetch(`${GMAIL_GATEWAY}/users/me/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")!}`,
      "X-Connection-Api-Key": Deno.env.get("GOOGLE_MAIL_API_KEY") ?? "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: encodeB64Url(new TextEncoder().encode(email)) }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    console.error(`gmail send failed [${res.status}]: ${errBody}`);
    throw new Error(`gmail ${res.status}: ${errBody}`);
  }
  return true;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildSummaryHtml(count: number, volume: number, prs: string[], unit: string, test = false) {
  const prItems = prs.length
    ? `<ul style="margin:8px 0 0;padding-left:20px;">${prs.map((p) => `<li style="margin:2px 0;">${escapeHtml(p)}</li>`).join("")}</ul>`
    : "<p style=\"margin:8px 0 0;color:#6b7280;\">No new personal bests this week.</p>";
  return `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111827;">
  <h1 style="font-size:20px;margin:0 0 4px;">${test ? "Weekly Workout Summary (test)" : "Weekly Workout Summary"}</h1>
  <p style="margin:0 0 16px;color:#6b7280;font-size:13px;">Your lifting week at a glance</p>
  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px;">
    <p style="margin:0 0 8px;font-size:16px;">🏋️ <strong>${count}</strong> workout${count === 1 ? "" : "s"}</p>
    <p style="margin:0 0 8px;font-size:16px;">💪 <strong>${Math.round(volume).toLocaleString()}</strong> ${escapeHtml(unit)} total volume</p>
    <p style="margin:0;font-size:14px;font-weight:600;">🏆 New personal bests</p>
    ${prItems}
  </div>
  <p style="margin:16px 0 0;color:#9ca3af;font-size:12px;">Sent by Lift Love Gains.</p>
</div>`;
}

async function deliverEmailSummary(
  admin: ReturnType<typeof createClient>,
  userId: string,
  to: string,
  tz: string,
  unit: string,
  test = false,
) {
  const { count, volume, prs } = await buildSummary(admin, userId, tz, unit);
  if (count === 0 && !test) return { sent: false, reason: "no-workouts" };
  const html = buildSummaryHtml(count, volume, prs, unit, test);
  const subject = test ? "Weekly Workout Summary (test)" : "Weekly Workout Summary";
  await sendGmailEmail(to, subject, html);
  return { sent: true, count };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  let body: any = {};
  try { body = await req.json(); } catch { /* cron may send empty */ }

  // Test modes: authenticated user sends a summary to their own devices / inbox now.
  if (body?.test === true || body?.testEmail === true) {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data, error } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (error || !data?.claims?.sub) return json({ error: "Not signed in" }, 401);
    const userId = data.claims.sub as string;

    if (body?.testEmail === true) {
      const to = (data.claims as any).email as string | undefined;
      if (!to) return json({ error: "No email on this account" }, 400);
      const tz = typeof body.timezone === "string" && body.timezone ? body.timezone : "UTC";
      const unit = typeof body.unit === "string" && body.unit ? body.unit : "lbs";
      try {
        const r = await deliverEmailSummary(admin, userId, to, tz, unit, true);
        if (!r.sent) return json({ error: "Email send failed" }, 502);
        return json({ sent: 1 });
      } catch (e: any) {
        return json({ error: e?.message ?? "Email send failed" }, 502);
      }
    }

    const { data: subs } = await admin.from("push_subscriptions").select("*").eq("user_id", userId);
    if (!subs?.length) return json({ error: "No devices registered for push" }, 404);
    let sent = 0;
    for (const s of subs as Sub[]) {
      const { count, volume, prs } = await buildSummary(admin, userId, s.timezone, s.weight_unit);
      if (await send(admin, s, { title: "Weekly Workout Summary (test)", body: summarizeText(count, volume, prs, s.weight_unit) })) sent++;
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
    await admin.from("push_subscriptions").update({ last_sent_week: weekKey }).eq("id", s.id);
    const { count, volume, prs } = await buildSummary(admin, s.user_id, s.timezone, s.weight_unit);
    if (count === 0) continue;
    if (await send(admin, s, { title: "Weekly Workout Summary", body: summarizeText(count, volume, prs, s.weight_unit) })) sent++;
  }

  // Email summaries, same day/hour logic.
  const { data: prefs } = await admin.from("summary_preferences").select("*").eq("email_enabled", true);
  for (const p of (prefs ?? []) as EmailPref[]) {
    const lp = localParts(p.timezone);
    if (lp.day !== p.notif_day || lp.hour !== p.notif_hour) continue;
    const weekKey = lp.date;
    if (p.email_last_sent_week === weekKey) continue;
    const { data: ud } = await admin.auth.admin.getUserById(p.user_id);
    const to = ud?.user?.email;
    if (!to) continue;
    try {
      const r = await deliverEmailSummary(admin, p.user_id, to, p.timezone, p.weight_unit);
      if (r.sent) {
        await admin.from("summary_preferences").update({ email_last_sent_week: weekKey }).eq("id", p.id);
        sent++;
      } else {
        await admin.from("summary_preferences").update({ email_last_sent_week: weekKey }).eq("id", p.id);
      }
    } catch (e: any) {
      console.error("weekly email failed", e?.message);
    }
  }
  return json({ sent });
});
