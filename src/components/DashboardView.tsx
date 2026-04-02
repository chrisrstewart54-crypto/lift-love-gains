import { useWorkout } from '@/context/WorkoutContext';
import { Dumbbell, Plus, Calendar, TrendingUp } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface DashboardViewProps {
  onStartWorkout: () => void;
}

export default function DashboardView({ onStartWorkout }: DashboardViewProps) {
  const { workoutLogs, activeWorkout, unit, toggleUnit, getExerciseById } = useWorkout();

  const recentLogs = workoutLogs.slice(0, 5);
  const totalWorkouts = workoutLogs.length;
  const thisWeekCount = workoutLogs.filter(log => {
    const d = new Date(log.date);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return d >= weekAgo;
  }).length;

  return (
    <div className="p-4 pb-24 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Workout Tracker</h1>
          <p className="text-muted-foreground text-sm">Let's get stronger 💪</p>
        </div>
        <button
          onClick={toggleUnit}
          className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium"
        >
          {unit.toUpperCase()}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Calendar className="w-4 h-4" />
            <span className="text-xs">This Week</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{thisWeekCount}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs">Total</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{totalWorkouts}</p>
        </div>
      </div>

      {/* Start Workout */}
      {activeWorkout ? (
        <button
          onClick={onStartWorkout}
          className="w-full py-4 rounded-xl bg-warning text-warning-foreground font-bold text-lg flex items-center justify-center gap-2"
        >
          <Dumbbell className="w-5 h-5" />
          Continue Workout
        </button>
      ) : (
        <button
          onClick={onStartWorkout}
          className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold text-lg flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Start New Workout
        </button>
      )}

      {/* Recent Activity */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Recent Workouts</h2>
        {recentLogs.length === 0 ? (
          <div className="bg-card rounded-xl p-8 border border-border text-center">
            <Dumbbell className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No workouts yet. Start your first one!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentLogs.map(log => (
              <div key={log.id} className="bg-card rounded-xl p-4 border border-border">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-foreground">{log.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(log.date), 'MMM d, yyyy')} · {formatDistanceToNow(new Date(log.date), { addSuffix: true })}
                    </p>
                  </div>
                  <span className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded-md">
                    {log.exercises.length} exercises
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {log.exercises.slice(0, 4).map(ex => {
                    const exercise = getExerciseById(ex.exerciseId);
                    return exercise ? (
                      <span key={ex.exerciseId} className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {exercise.name}
                      </span>
                    ) : null;
                  })}
                  {log.exercises.length > 4 && (
                    <span className="text-xs text-muted-foreground">+{log.exercises.length - 4} more</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
