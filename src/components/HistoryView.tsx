import { useWorkout } from '@/context/WorkoutContext';
import { format } from 'date-fns';
import { Calendar, Clock, Dumbbell, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { calculateSetVolume } from '@/types/workout';

export default function HistoryView() {
  const { workoutLogs, unit, getExerciseById } = useWorkout();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="p-4 pb-24 space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold text-foreground">Workout History</h1>

      {workoutLogs.length === 0 ? (
        <div className="bg-card rounded-xl p-8 border border-border text-center">
          <Dumbbell className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No workouts logged yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {workoutLogs.map(log => {
            const isExpanded = expandedId === log.id;
            const totalSets = log.exercises.reduce((sum, e) => sum + e.sets.length, 0);
            const totalVolume = log.exercises.reduce(
              (sum, e) => {
                const equipment = getExerciseById(e.exerciseId)?.equipment;
                return sum + e.sets.reduce((s, set) => s + calculateSetVolume(set.weight, set.reps, equipment), 0);
              }, 0
            );

            return (
              <div key={log.id} className="bg-card rounded-xl border border-border overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  className="w-full px-4 py-4 text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-foreground text-base">{log.name}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(log.date), 'MMM d, yyyy')}
                        </span>
                        {log.duration != null && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {log.duration} min
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">{log.exercises.length} exercises · {totalSets} sets</p>
                        <p className="text-xs text-muted-foreground">{totalVolume.toLocaleString()} {unit} volume</p>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                    {log.exercises.map(we => {
                      const exercise = getExerciseById(we.exerciseId);
                      return (
                        <div key={we.exerciseId}>
                          <p className="font-medium text-foreground text-sm">{exercise?.name ?? 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground mb-1">{exercise?.muscleGroup} · {exercise?.equipment}</p>
                          <div className="grid grid-cols-3 gap-1 text-xs text-muted-foreground mb-1">
                            <span>SET</span>
                            <span className="text-center">WEIGHT</span>
                            <span className="text-center">REPS</span>
                          </div>
                          {we.sets.map(set => (
                            <div key={set.id} className="grid grid-cols-3 gap-1 text-sm text-foreground">
                              <span className="text-muted-foreground">{set.setNumber}</span>
                              <span className="text-center">{set.weight} {unit}</span>
                              <span className="text-center">{set.reps}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
