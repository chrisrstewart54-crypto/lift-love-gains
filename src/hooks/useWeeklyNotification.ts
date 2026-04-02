import { useEffect, useCallback } from 'react';
import { WorkoutLog } from '@/types/workout';

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeeklyStats(logs: WorkoutLog[], allLogs: WorkoutLog[]) {
  const weekStart = getWeekStart(new Date());
  const weekLogs = logs.filter(l => new Date(l.date) >= weekStart);

  const numWorkouts = weekLogs.length;
  let totalVolume = 0;
  const prs: string[] = [];

  // Calculate historical max weights per exercise (before this week)
  const historicalMax: Record<string, number> = {};
  for (const log of allLogs) {
    if (new Date(log.date) >= weekStart) continue;
    for (const ex of log.exercises) {
      for (const s of ex.sets) {
        if (!historicalMax[ex.exerciseId] || s.weight > historicalMax[ex.exerciseId]) {
          historicalMax[ex.exerciseId] = s.weight;
        }
      }
    }
  }

  // Track this week's max per exercise for PR detection
  const weekMax: Record<string, number> = {};
  for (const log of weekLogs) {
    for (const ex of log.exercises) {
      for (const s of ex.sets) {
        totalVolume += s.weight * s.reps;
        if (!weekMax[ex.exerciseId] || s.weight > weekMax[ex.exerciseId]) {
          weekMax[ex.exerciseId] = s.weight;
        }
      }
    }
  }

  for (const [exId, maxW] of Object.entries(weekMax)) {
    if (!historicalMax[exId] || maxW > historicalMax[exId]) {
      prs.push(exId);
    }
  }

  return { numWorkouts, totalVolume, prs };
}

export function useWeeklyNotification(
  workoutLogs: WorkoutLog[],
  getExerciseName: (id: string) => string | undefined
) {
  const checkAndNotify = useCallback(() => {
    if (!('Notification' in window)) return;

    const now = new Date();
    // Only trigger on Sunday (day 0) at or after 8 PM
    if (now.getDay() !== 0 || now.getHours() < 20) return;

    const weekKey = `weeklySummary_${getWeekStart(now).toISOString().slice(0, 10)}`;
    if (localStorage.getItem(weekKey)) return;

    if (Notification.permission === 'default') {
      Notification.requestPermission();
      return;
    }
    if (Notification.permission !== 'granted') return;

    const { numWorkouts, totalVolume, prs } = getWeeklyStats(workoutLogs, workoutLogs);
    if (numWorkouts === 0) return;

    const prNames = prs.map(id => getExerciseName(id)).filter(Boolean);
    let body = `🏋️ ${numWorkouts} workout${numWorkouts > 1 ? 's' : ''}\n💪 ${totalVolume.toLocaleString()} total volume`;
    if (prNames.length > 0) {
      body += `\n🏆 New PRs: ${prNames.join(', ')}`;
    }

    new Notification('Weekly Workout Summary', { body, icon: '/placeholder.svg' });
    localStorage.setItem(weekKey, 'sent');
  }, [workoutLogs, getExerciseName]);

  useEffect(() => {
    // Check on mount and every 10 minutes
    checkAndNotify();
    const interval = setInterval(checkAndNotify, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkAndNotify]);
}
