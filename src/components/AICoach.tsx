import { useRef, useState } from 'react';
import { Sparkles, Square } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useWorkout } from '@/context/WorkoutContext';
import { supabase } from '@/integrations/supabase/client';

const GOAL_IDEAS = ['Hit a new 1RM in 8 weeks', 'Build muscle (hypertrophy)', 'Increase reps at my working weight'];

export default function AICoach({ exerciseId }: { exerciseId: string }) {
  const { getExerciseById, getExerciseHistory, unit } = useWorkout();
  const [goal, setGoal] = useState('');
  const [plan, setPlan] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const exercise = getExerciseById(exerciseId);

  const run = async () => {
    if (!exercise || !goal.trim()) return;
    setLoading(true); setError(''); setPlan('');
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const history = getExerciseHistory(exerciseId).slice(-40).map(h => ({
        date: h.date.slice(0, 10),
        sets: h.sets.map(s => `${s.weight}x${s.reps}`),
      }));
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/progression-plan`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ exercise, goal, unit, history }),
      });
      if (!res.ok || !res.body) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || 'Could not create a plan.');
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '', text = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const ev = JSON.parse(payload);
            if (ev.type === 'response.output_text.delta') { text += ev.delta; setPlan(text); }
            else if (ev.type === 'error' || ev.type === 'response.failed') {
              throw new Error(ev.error?.message || ev.response?.error?.message || 'The AI coach stopped unexpectedly.');
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
      if (!text.trim()) throw new Error('The AI coach returned an empty plan. Please try again.');
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message);
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" />
        <p className="font-semibold text-foreground">AI Progression Coach</p>
      </div>
      {!exercise ? (
        <p className="text-sm text-muted-foreground">Select an exercise above to get a personalized plan.</p>
      ) : (
        <>
          <textarea
            value={goal}
            onChange={e => setGoal(e.target.value)}
            placeholder={`Your goal for ${exercise.name}, e.g. "Bench 100kg by December"`}
            rows={2}
            maxLength={500}
            className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground text-base resize-none"
          />
          <div className="flex flex-wrap gap-2">
            {GOAL_IDEAS.map(g => (
              <button key={g} onClick={() => setGoal(g)} className="text-xs px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground">
                {g}
              </button>
            ))}
          </div>
          {loading ? (
            <button onClick={() => abortRef.current?.abort()} className="w-full py-3 rounded-xl bg-secondary text-secondary-foreground font-semibold flex items-center justify-center gap-2">
              <Square className="w-4 h-4" /> Stop
            </button>
          ) : (
            <button onClick={run} disabled={!goal.trim()} className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-50">
              Get my plan
            </button>
          )}
          {loading && !plan && <p className="text-sm text-muted-foreground animate-pulse">Analyzing your logged sets…</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {plan && (
            <div className="prose prose-sm prose-invert max-w-none text-foreground [&_table]:text-xs [&_th]:px-2 [&_td]:px-2">
              <ReactMarkdown>{plan}</ReactMarkdown>
            </div>
          )}
        </>
      )}
    </div>
  );
}
