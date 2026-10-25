import { supabase } from "@/integrations/supabase/client";

export interface EmailSummaryState {
  enabled: boolean;
}

export async function getEmailSummaryPref(): Promise<EmailSummaryState> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { enabled: false };
  const { data } = await supabase
    .from("summary_preferences")
    .select("email_enabled")
    .eq("user_id", u.user.id)
    .maybeSingle();
  return { enabled: !!data?.email_enabled };
}

export async function setEmailSummary(
  enabled: boolean,
  opts: { day: number; hour: number; unit: string }
) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const row = {
    user_id: u.user.id,
    email_enabled: enabled,
    notif_day: opts.day,
    notif_hour: opts.hour,
    weight_unit: opts.unit,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  };
  const { error } = await supabase.from("summary_preferences").upsert(row, { onConflict: "user_id" });
  if (error) throw error;
}

export async function sendTestEmail() {
  const { data, error } = await supabase.functions.invoke("send-weekly-summary", {
    body: {
      testEmail: true,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      unit: (localStorage.getItem("weightUnit")?.replace(/"/g, "") || "lbs"),
    },
  });
  if (error) throw error;
  return data as { sent?: number; error?: string };
}
