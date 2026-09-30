import { createClient } from "npm:@supabase/supabase-js@2";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  getLovableAiGatewayResponseHeaders,
} from "../_shared/run-id.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-lovable-aig-run-id",
  "Access-Control-Expose-Headers": "X-Lovable-AIG-Run-ID",
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SYSTEM = `You are an experienced strength & conditioning coach. Analyze the athlete's logged sets for one exercise and write a personalized, safe progression plan toward their goal.
Format in concise Markdown:
## Where you are now (2-4 bullets: current working weights/reps, est. 1RM trend, consistency)
## Plan (a week-by-week table or list for 4-8 weeks with sets x reps @ weight in their unit)
## Progression rules (when to add weight, when to hold, deload guidance)
## Tips (2-3 short bullets)
Use the athlete's unit. For dumbbell exercises, weights are per hand. Be realistic; if data is sparse, say so and give a conservative starting plan. Keep under 450 words. No medical claims.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "Please sign in." }, 401);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: claims, error: authErr } = await supabase.auth.getClaims(auth.slice(7));
  if (authErr || !claims?.claims?.sub) return json({ error: "Please sign in." }, 401);

  let body: { exercise?: { name?: string; muscleGroup?: string; equipment?: string }; goal?: string; unit?: string; history?: unknown };
  try { body = await req.json(); } catch { return json({ error: "Invalid request." }, 400); }
  const goal = String(body.goal ?? "").trim().slice(0, 500);
  if (!goal || !body.exercise?.name) return json({ error: "Pick an exercise and enter a goal." }, 400);
  const history = JSON.stringify(body.history ?? []).slice(0, 30000);

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ error: "AI is not configured." }, 500);

  const prompt = `Exercise: ${body.exercise.name} (${body.exercise.muscleGroup ?? "?"}, ${body.exercise.equipment ?? "?"})
Unit: ${body.unit === "kg" ? "kg" : "lbs"}
Goal: ${goal}
Today: ${new Date().toISOString().slice(0, 10)}
Logged sessions (oldest first, each set = weight x reps):
${history}`;

  const gateway = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(req));
  try {
    const upstream = await gateway.fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      signal: req.signal,
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        instructions: SYSTEM,
        input: prompt,
        stream: true,
        store: false,
        reasoning: { effort: "medium", summary: "auto" },
        include: ["reasoning.encrypted_content"],
      }),
    });
    if (!upstream.ok) {
      let message = "The AI coach couldn't create a plan right now.";
      try { const e = await upstream.json(); message = e?.error?.message ?? e?.message ?? message; } catch { /* ignore */ }
      if (upstream.status === 402) message = "AI credits have run out. Add credits in Settings → Plans & credits.";
      if (upstream.status === 429) message = "Too many requests — please wait a moment and try again.";
      return json({ error: message }, upstream.status);
    }
    const headers = getLovableAiGatewayResponseHeaders(upstream.headers, corsHeaders);
    headers.set("Content-Type", "text/event-stream");
    return new Response(upstream.body, { status: 200, headers });
  } catch (error) {
    if (req.signal.aborted) return new Response(null, { status: 499, headers: corsHeaders });
    console.error("progression-plan failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "The AI coach couldn't create a plan right now." }, 500);
  }
});
