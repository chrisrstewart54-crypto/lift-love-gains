import { useState, useMemo } from 'react';
import { useWorkout } from '@/context/WorkoutContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { TrendingUp } from 'lucide-react';

type Metric = 'e1rm' | 'maxWeight';

function calcE1RM(weight: number, reps: number): number {
  if (reps === 0 || weight === 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10; // Epley formula
}

export default function ProgressView() {
  const { exercises, unit, getExerciseHistory } = useWorkout();
  const [selectedExercise, setSelectedExercise] = useState(exercises[0]?.id || '');
  const [metric, setMetric] = useState<Metric>('e1rm');

  const history = useMemo(() => {
    if (!selectedExercise) return [];
    return getExerciseHistory(selectedExercise);
  }, [selectedExercise, getExerciseHistory]);

  const chartData = useMemo(() => {
    return history.map(entry => {
      let value = 0;
      if (metric === 'e1rm') {
        value = Math.max(...entry.sets.map(s => calcE1RM(s.weight, s.reps)));
      } else {
        value = Math.max(...entry.sets.map(s => s.weight));
      }
      return {
        date: format(new Date(entry.date), 'MMM d'),
        value: value || 0,
      };
    });
  }, [history, metric]);

  return (
    <div className="p-4 pb-24 space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold text-foreground">Progress</h1>

      {/* Exercise selector */}
      <select
        value={selectedExercise}
        onChange={e => setSelectedExercise(e.target.value)}
        className="w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground text-base"
      >
        <option value="">Select an exercise</option>
        {exercises.map(ex => (
          <option key={ex.id} value={ex.id}>{ex.name}</option>
        ))}
      </select>

      {/* Metric toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setMetric('e1rm')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            metric === 'e1rm' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
          }`}
        >
          Est. 1RM
        </button>
        <button
          onClick={() => setMetric('maxWeight')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            metric === 'maxWeight' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
          }`}
        >
          Max Weight
        </button>
      </div>

      {/* Chart */}
      {chartData.length > 0 ? (
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground mb-3">
            {metric === 'e1rm' ? 'Estimated 1RM' : 'Max Weight'} ({unit})
          </p>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 22%)" />
              <XAxis dataKey="date" tick={{ fill: 'hsl(215, 15%, 55%)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'hsl(215, 15%, 55%)', fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(220, 18%, 14%)',
                  border: '1px solid hsl(220, 14%, 22%)',
                  borderRadius: '8px',
                  color: 'hsl(210, 20%, 92%)',
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="hsl(142, 70%, 45%)"
                strokeWidth={2}
                dot={{ fill: 'hsl(142, 70%, 45%)', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="bg-card rounded-xl p-8 border border-border text-center">
          <TrendingUp className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">
            {selectedExercise ? 'No data yet for this exercise' : 'Select an exercise to view progress'}
          </p>
        </div>
      )}

      {/* Data table */}
      {chartData.length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-medium text-foreground">History</p>
          </div>
          {history.map((entry, i) => (
            <div key={i} className="px-4 py-3 border-b border-border last:border-b-0">
              <p className="text-sm font-medium text-foreground mb-1">{format(new Date(entry.date), 'MMM d, yyyy')}</p>
              <div className="flex flex-wrap gap-2">
                {entry.sets.map(s => (
                  <span key={s.id} className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">
                    {s.weight}{unit} × {s.reps}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
