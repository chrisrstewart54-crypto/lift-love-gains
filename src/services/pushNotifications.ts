import { supabase } from "@/integrations/supabase/client";

export const VAPID_PUBLIC_KEY =
  "BFbmRpfHwLUmASsLr_pEuc6jql5kUfNC83sLHnGWjkYXXJINjpDEGBeGJbknF1J8k8rgcIa92CeAf85WeJ76gvk";

export type PushStatus = "subscribed" | "unsupported" | "open-in-new-tab" | "denied" | "no-sw" | "error";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function getRegistration() {
  const regs = await navigator.serviceWorker.getRegistrations();
  return regs.find((r) => (r.active?.scriptURL ?? "").endsWith("/sw.js")) ?? null;
}

export async function getExistingSubscription() {
  if (!pushSupported()) return null;
  const reg = await getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function enablePush(opts: { day: number; hour: number; unit: string }): Promise<PushStatus> {
  if (!pushSupported()) return "unsupported";
  if (window.top !== window.self) return "open-in-new-tab";
  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  const reg = await getRegistration();
  if (!reg) return "no-sw";
  try {
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    await saveSubscription(sub, opts);
    return "subscribed";
  } catch (e) {
    console.error("Push subscribe failed", e);
    return "error";
  }
}

export async function saveSubscription(sub: PushSubscription, opts: { day: number; hour: number; unit: string }) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const json = sub.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: u.user.id,
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
      notif_day: opts.day,
      notif_hour: opts.hour,
      weight_unit: opts.unit,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    },
    { onConflict: "endpoint" }
  );
  if (error) throw error;
}

export async function updateSchedule(opts: { day: number; hour: number; unit: string }) {
  const sub = await getExistingSubscription();
  if (sub) await saveSubscription(sub, opts);
}

export async function disablePush() {
  const sub = await getExistingSubscription();
  if (!sub) return;
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}

export async function sendTestPush() {
  const { data, error } = await supabase.functions.invoke("send-weekly-summary", { body: { test: true } });
  if (error) throw error;
  return data as { sent: number };
}
