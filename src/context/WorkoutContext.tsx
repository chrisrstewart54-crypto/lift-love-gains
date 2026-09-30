import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Exercise, WorkoutLog, ActiveWorkout, WeightUnit, SetData, WorkoutTemplate, DEFAULT_EXERCISES, MuscleGroup, Equipment } from '@/types/workout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

interface WorkoutContextType {
  exercises: Exercise[];
  workoutLogs: WorkoutLog[];
  activeWorkout: ActiveWorkout | null;
  unit: WeightUnit;
  templates: WorkoutTemplate[];
  addExercise: (exercise: Omit<Exercise, 'id'>) => void;
  deleteExercise: (id: string) => void;
  startWorkout: (name: string) => void;
  startWorkoutFromTemplate: (templateId: string) => void;
  addExerciseToWorkout: (exerciseId: string) => void;
  removeExerciseFromWorkout: (exerciseId: string) => void;
  addSet: (exerciseId: string) => void;
  updateSet: (exerciseId: string, setId: string, field: 'weight' | 'reps', value: number) => void;
  reorderExercise: (exerciseId: string, direction: 'up' | 'down') => void;
  removeSet: (exerciseId: string, setId: string) => void;
  finishWorkout: () => void;
  cancelWorkout: () => void;
  toggleUnit: () => void;
  getLastRecord: (exerciseId: string) => SetData[] | null;
  getExerciseById: (id: string) => Exercise | undefined;
  getExerciseHistory: (exerciseId: string) => { date: string; sets: SetData[] }[];
  saveAsTemplate: (name: string, exerciseIds: string[]) => void;
  deleteTemplate: (id: string) => void;
}

const WorkoutContext = createContext<WorkoutContextType | null>(null);

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

const LBS_TO_KG = 0.453592;
const KG_TO_LBS = 2.20462;

export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(() => loadFromStorage('activeWorkout', null));
  const [unit, setUnit] = useState<WeightUnit>(() => loadFromStorage('weightUnit', 'lbs'));
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const loadedFor = useRef<string | null>(null);

  useEffect(() => saveToStorage('activeWorkout', activeWorkout), [activeWorkout]);
  useEffect(() => saveToStorage('weightUnit', unit), [unit]);

  const fail = (what: string, error: unknown) => {
    console.error(what, error);
    toast.error(`Couldn't sync ${what}. Check your connection.`);
  };

  // Load from cloud; on first sign-in, copy any data saved on this device
  useEffect(() => {
    if (!userId || loadedFor.current === userId) return;
    loadedFor.current = userId;
    (async () => {
      const [exR, logR, tplR, profR] = await Promise.all([
        supabase.from('exercises').select('*').order('created_at'),
        supabase.from('workout_logs').select('*').order('date', { ascending: false }),
        supabase.from('workout_templates').select('*').order('created_at'),
        supabase.from('profiles').select('weight_unit').eq('user_id', userId).maybeSingle(),
      ]);
      if (exR.error || logR.error || tplR.error) return fail('your data', exR.error || logR.error || tplR.error);
      if (profR.data?.weight_unit === 'kg' || profR.data?.weight_unit === 'lbs') setUnit(profR.data.weight_unit);

      let exs: Exercise[] = exR.data.map(r => ({ id: r.id, name: r.name, muscleGroup: r.muscle_group as MuscleGroup, equipment: r.equipment as Equipment }));
      let logs: WorkoutLog[] = logR.data.map(r => ({ id: r.id, name: r.name, date: r.date, duration: r.duration, exercises: (r.exercises as unknown as WorkoutLog['exercises']) ?? [] }));
      let tpls: WorkoutTemplate[] = tplR.data.map(r => ({ id: r.id, name: r.name, exerciseIds: r.exercise_ids }));

      if (exs.length === 0) {
        // First time: seed from this device (or defaults) and migrate local history
        const localEx: Exercise[] = loadFromStorage('exercises', DEFAULT_EXERCISES);
        const { data, error } = await supabase.from('exercises').insert(
          localEx.map(e => ({ user_id: userId, name: e.name, muscle_group: e.muscleGroup, equipment: e.equipment }))
        ).select();
        if (error || !data) return fail('exercises', error);
        const idMap = new Map<string, string>();
        localEx.forEach((e, i) => idMap.set(e.id, data[i].id));
        exs = data.map(r => ({ id: r.id, name: r.name, muscleGroup: r.muscle_group as MuscleGroup, equipment: r.equipment as Equipment }));
        const remap = (id: string) => idMap.get(id) ?? id;

        const localLogs: WorkoutLog[] = loadFromStorage('workoutLogs', []);
        if (localLogs.length && logs.length === 0) {
          const { data: ld, error: le } = await supabase.from('workout_logs').insert(localLogs.map(l => ({
            user_id: userId, name: l.name, date: l.date, duration: l.duration ?? 0,
            exercises: l.exercises.map(e => ({ ...e, exerciseId: remap(e.exerciseId) })) as unknown as Json,
          }))).select();
          if (le || !ld) return fail('workout history', le);
          logs = ld.map(r => ({ id: r.id, name: r.name, date: r.date, duration: r.duration, exercises: r.exercises as unknown as WorkoutLog['exercises'] }))
            .sort((a, b) => b.date.localeCompare(a.date));
        }
        const localTpl: WorkoutTemplate[] = loadFromStorage('workoutTemplates', []);
        if (localTpl.length && tpls.length === 0) {
          const { data: td, error: te } = await supabase.from('workout_templates').insert(localTpl.map(t => ({
            user_id: userId, name: t.name, exercise_ids: t.exerciseIds.map(remap),
          }))).select();
          if (te || !td) return fail('templates', te);
          tpls = td.map(r => ({ id: r.id, name: r.name, exerciseIds: r.exercise_ids }));
        }
        // Remap any in-progress workout
        setActiveWorkout(aw => aw ? { ...aw, exercises: aw.exercises.map(e => ({ ...e, exerciseId: remap(e.exerciseId) })) } : aw);
        // Only clear local copies once everything uploaded successfully
        ['exercises', 'workoutLogs', 'workoutTemplates'].forEach(k => localStorage.removeItem(k));
      }
      setExercises(exs);
      setWorkoutLogs(logs);
      setTemplates(tpls);
    })();
  }, [userId]);

  const addExercise = useCallback(async (exercise: Omit<Exercise, 'id'>) => {
    if (!userId) return;
    const { data, error } = await supabase.from('exercises').insert({
      user_id: userId, name: exercise.name, muscle_group: exercise.muscleGroup, equipment: exercise.equipment,
    }).select().single();
    if (error || !data) return fail('exercise', error);
    setExercises(prev => [...prev, { ...exercise, id: data.id }]);
  }, [userId]);

  const deleteExercise = useCallback(async (id: string) => {
    const { error } = await supabase.from('exercises').delete().eq('id', id);
    if (error) return fail('exercise', error);
    setExercises(prev => prev.filter(e => e.id !== id));
  }, []);

  const startWorkout = useCallback((name: string) => {
    setActiveWorkout({ name, exercises: [], startedAt: new Date().toISOString() });
  }, []);

  const startWorkoutFromTemplate = useCallback((templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;
    setActiveWorkout({
      name: template.name,
      exercises: template.exerciseIds.map(id => ({ exerciseId: id, sets: [] })),
      startedAt: new Date().toISOString(),
    });
  }, [templates]);

  const saveAsTemplate = useCallback(async (name: string, exerciseIds: string[]) => {
    if (!userId) return;
    const { data, error } = await supabase.from('workout_templates').insert({ user_id: userId, name, exercise_ids: exerciseIds }).select().single();
    if (error || !data) return fail('template', error);
    setTemplates(prev => [...prev, { id: data.id, name, exerciseIds }]);
  }, [userId]);

  const deleteTemplate = useCallback(async (id: string) => {
    const { error } = await supabase.from('workout_templates').delete().eq('id', id);
    if (error) return fail('template', error);
    setTemplates(prev => prev.filter(t => t.id !== id));
  }, []);

  const addExerciseToWorkout = useCallback((exerciseId: string) => {
    setActiveWorkout(prev => {
      if (!prev || prev.exercises.some(e => e.exerciseId === exerciseId)) return prev;
      return { ...prev, exercises: [...prev.exercises, { exerciseId, sets: [] }] };
    });
  }, []);

  const removeExerciseFromWorkout = useCallback((exerciseId: string) => {
    setActiveWorkout(prev => {
      if (!prev) return prev;
      return { ...prev, exercises: prev.exercises.filter(e => e.exerciseId !== exerciseId) };
    });
  }, []);

  const addSet = useCallback((exerciseId: string) => {
    setActiveWorkout(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: prev.exercises.map(e => {
          if (e.exerciseId !== exerciseId) return e;
          const newSet: SetData = {
            id: generateId(),
            setNumber: e.sets.length + 1,
            weight: 0,
            reps: 0,
          };
          return { ...e, sets: [...e.sets, newSet] };
        }),
      };
    });
  }, []);

  const updateSet = useCallback((exerciseId: string, setId: string, field: 'weight' | 'reps', value: number) => {
    setActiveWorkout(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: prev.exercises.map(e => {
          if (e.exerciseId !== exerciseId) return e;
          return {
            ...e,
            sets: e.sets.map(s => s.id === setId ? { ...s, [field]: value } : s),
          };
        }),
      };
    });
  }, []);

  const removeSet = useCallback((exerciseId: string, setId: string) => {
    setActiveWorkout(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: prev.exercises.map(e => {
          if (e.exerciseId !== exerciseId) return e;
          const filtered = e.sets.filter(s => s.id !== setId);
          return { ...e, sets: filtered.map((s, i) => ({ ...s, setNumber: i + 1 })) };
        }),
      };
    });
  }, []);

  const reorderExercise = useCallback((exerciseId: string, direction: 'up' | 'down') => {
    setActiveWorkout(prev => {
      if (!prev) return prev;
      const idx = prev.exercises.findIndex(e => e.exerciseId === exerciseId);
      if (idx < 0) return prev;
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.exercises.length) return prev;
      const arr = [...prev.exercises];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return { ...prev, exercises: arr };
    });
  }, []);

  const finishWorkout = useCallback(async () => {
    if (!activeWorkout || !userId) return;
    const exercisesWithSets = activeWorkout.exercises.filter(e => e.sets.length > 0);
    const log: WorkoutLog = {
      id: generateId(),
      name: activeWorkout.name,
      date: new Date().toISOString(),
      exercises: exercisesWithSets,
      duration: Math.round((Date.now() - new Date(activeWorkout.startedAt).getTime()) / 60000),
    };
    const { data, error } = await supabase.from('workout_logs').insert({
      user_id: userId, name: log.name, date: log.date, duration: log.duration ?? 0,
      exercises: log.exercises as unknown as Json,
    }).select().single();
    if (error || !data) {
      // Keep the active workout so nothing is lost; user can retry
      return fail('workout', error);
    }
    setWorkoutLogs(prev => [{ ...log, id: data.id }, ...prev]);
    setActiveWorkout(null);
  }, [activeWorkout, userId]);

  const cancelWorkout = useCallback(() => {
    setActiveWorkout(null);
  }, []);

  const toggleUnit = useCallback(() => {
    const convert = (value: number, toKg: boolean) =>
      Math.round((toKg ? value * LBS_TO_KG : value * KG_TO_LBS) * 10) / 10;

    setUnit(prev => {
      const toKg = prev === 'lbs';
      const newUnit = toKg ? 'kg' : 'lbs';

      // Convert active workout
      setActiveWorkout(aw => {
        if (!aw) return aw;
        return {
          ...aw,
          exercises: aw.exercises.map(e => ({
            ...e,
            sets: e.sets.map(s => ({ ...s, weight: convert(s.weight, toKg) })),
          })),
        };
      });

      // Convert logs (and save converted values to the cloud)
      setWorkoutLogs(logs => {
        const converted = logs.map(log => ({
          ...log,
          exercises: log.exercises.map(e => ({
            ...e,
            sets: e.sets.map(s => ({ ...s, weight: convert(s.weight, toKg) })),
          })),
        }));
        converted.forEach(l => {
          supabase.from('workout_logs').update({ exercises: l.exercises as unknown as Json }).eq('id', l.id)
            .then(({ error }) => { if (error) console.error(error); });
        });
        return converted;
      });
      if (userId) supabase.from('profiles').update({ weight_unit: newUnit }).eq('user_id', userId)
        .then(({ error }) => { if (error) console.error(error); });

      return newUnit;
    });
  }, [userId]);

  const getLastRecord = useCallback((exerciseId: string): SetData[] | null => {
    for (const log of workoutLogs) {
      const ex = log.exercises.find(e => e.exerciseId === exerciseId);
      if (ex && ex.sets.length > 0) return ex.sets;
    }
    return null;
  }, [workoutLogs]);

  const getExerciseById = useCallback((id: string) => {
    return exercises.find(e => e.id === id);
  }, [exercises]);

  const getExerciseHistory = useCallback((exerciseId: string) => {
    return workoutLogs
      .filter(log => log.exercises.some(e => e.exerciseId === exerciseId))
      .map(log => ({
        date: log.date,
        sets: log.exercises.find(e => e.exerciseId === exerciseId)!.sets,
      }))
      .reverse();
  }, [workoutLogs]);

  return (
    <WorkoutContext.Provider value={{
      exercises, workoutLogs, activeWorkout, unit, templates,
      addExercise, deleteExercise, startWorkout, startWorkoutFromTemplate,
      addExerciseToWorkout, removeExerciseFromWorkout,
      addSet, updateSet, removeSet, reorderExercise,
      finishWorkout, cancelWorkout, toggleUnit,
      getLastRecord, getExerciseById, getExerciseHistory,
      saveAsTemplate, deleteTemplate,
    }}>
      {children}
    </WorkoutContext.Provider>
  );
}

export function useWorkout() {
  const ctx = useContext(WorkoutContext);
  if (!ctx) throw new Error('useWorkout must be used within WorkoutProvider');
  return ctx;
}
