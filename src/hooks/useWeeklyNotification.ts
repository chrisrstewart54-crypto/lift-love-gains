import { useEffect, useCallback } from 'react';
import { WorkoutLog, calculateSetVolume } from '@/types/workout';

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function loadSetting<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}

function getWeeklyStats(logs: WorkoutLog[], getEquipment: (id: string) => string | undefined) {
  const weekStart = getWeekStart(new Date());
  const weekLogs = logs.filter(l => new Date(l.date) >= weekStart);

  const numWorkouts = weekLogs.length;
  let totalVolume = 0;
  const prs: string[] = [];

  const historicalMax: Record<string, number> = {};
  for (const log of logs) {
    if (new Date(log.date) >= weekStart) continue;
    for (const ex of log.exercises) {
      for (const s of ex.sets) {
        if (!historicalMax[ex.exerciseId] || s.weight > historicalMax[ex.exerciseId]) {
          historicalMax[ex.exerciseId] = s.weight;
        }
      }
    }
  }

  const weekMax: Record<string, number> = {};
  for (const log of weekLogs) {
    for (const ex of log.exercises) {
      const equipment = getEquipment(ex.exerciseId);
      for (const s of ex.sets) {
        totalVolume += calculateSetVolume(s.weight, s.reps, equipment);
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
  getExercise: (id: string) => { name: string; equipment?: string } | undefined
) {
  const checkAndNotify = useCallback(() => {
    if (!('Notification' in window)) return;

    const enabled = loadSetting('notifEnabled', true);
    if (!enabled) return;

    const notifDay = loadSetting('notifDay', 0); // 0=Sunday
    const notifHour = loadSetting('notifHour', 20); // 8 PM

    const now = new Date();
    if (now.getDay() !== notifDay || now.getHours() < notifHour) return;

    const weekKey = `weeklySummary_${getWeekStart(now).toISOString().slice(0, 10)}`;
    if (localStorage.getItem(weekKey)) return;

    if (Notification.permission === 'default') {
      Notification.requestPermission();
      return;
    }
    if (Notification.permission !== 'granted') return;

    const { numWorkouts, totalVolume, prs } = getWeeklyStats(
      workoutLogs,
      (id) => getExercise(id)?.equipment
    );
    if (numWorkouts === 0) return;

    const prNames = prs.map(id => getExercise(id)?.name).filter(Boolean);
    let body = `🏋️ ${numWorkouts} workout${numWorkouts > 1 ? 's' : ''}\n💪 ${totalVolume.toLocaleString()} total volume`;
    if (prNames.length > 0) {
      body += `\n🏆 New PRs: ${prNames.join(', ')}`;
    }

    new Notification('Weekly Workout Summary', { body, icon: '/placeholder.svg' });
    localStorage.setItem(weekKey, 'sent');
  }, [workoutLogs, getExercise]);

  useEffect(() => {
    checkAndNotify();
    const interval = setInterval(checkAndNotify, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkAndNotify]);
}
