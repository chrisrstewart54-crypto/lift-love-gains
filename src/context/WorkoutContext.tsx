import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Exercise, WorkoutLog, ActiveWorkout, WeightUnit, SetData, WorkoutExercise, WorkoutTemplate, DEFAULT_EXERCISES } from '@/types/workout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

interface WorkoutContextType {
  exercises: Exercise[];
  workoutLogs: WorkoutLog[];
  activeWorkout: ActiveWorkout | null;
  unit: WeightUnit;
  templates: WorkoutTemplate[];
  loading: boolean;
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
  importData: (data: { exercises?: Exercise[]; workoutLogs?: WorkoutLog[]; templates?: WorkoutTemplate[]; unit?: WeightUnit }) => void;
  exportData: () => { exercises: Exercise[]; workoutLogs: WorkoutLog[]; templates: WorkoutTemplate[]; unit: WeightUnit };
}

const WorkoutContext = createContext<WorkoutContextType | null>(null);

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

const LBS_TO_KG = 0.453592;
const KG_TO_LBS = 2.20462;

export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(null);
  const [unit, setUnit] = useState<WeightUnit>('lbs');
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Load data from Supabase when user is available
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    loadFromCloud();
  }, [user]);

  const loadFromCloud = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Load profile (unit)
      const { data: profile } = await supabase
        .from('profiles')
        .select('weight_unit')
        .eq('user_id', user.id)
        .single();
      if (profile) setUnit(profile.weight_unit as WeightUnit);

      // Load exercises
      const { data: dbExercises } = await supabase
        .from('exercises')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      
      if (dbExercises && dbExercises.length > 0) {
        setExercises(dbExercises.map(e => ({
          id: e.id,
          name: e.name,
          muscleGroup: e.muscle_group as Exercise['muscleGroup'],
          equipment: e.equipment as Exercise['equipment'],
        })));
      } else {
        // First login — seed defaults and migrate localStorage
        await migrateLocalData();
        return; // migrateLocalData sets loading to false
      }

      // Load workout logs
      const { data: dbLogs } = await supabase
        .from('workout_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });
      if (dbLogs) {
        setWorkoutLogs(dbLogs.map(l => ({
          id: l.id,
          name: l.name,
          date: l.date,
          duration: l.duration,
          exercises: l.exercises as unknown as WorkoutExercise[],
        })));
      }

      // Load templates
      const { data: dbTemplates } = await supabase
        .from('workout_templates')
        .select('*')
        .eq('user_id', user.id);
      if (dbTemplates) {
        setTemplates(dbTemplates.map(t => ({
          id: t.id,
          name: t.name,
          exerciseIds: t.exercise_ids,
        })));
      }

      // Restore active workout from localStorage (ephemeral)
      try {
        const aw = localStorage.getItem('activeWorkout');
        if (aw) setActiveWorkout(JSON.parse(aw));
      } catch {}
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const migrateLocalData = async () => {
    if (!user) return;
    try {
      // Get local data
      const localExercisesRaw = localStorage.getItem('exercises');
      const localLogsRaw = localStorage.getItem('workoutLogs');
      const localTemplatesRaw = localStorage.getItem('workoutTemplates');
      const localUnit = localStorage.getItem('weightUnit');

      const localExercises: Exercise[] = localExercisesRaw ? JSON.parse(localExercisesRaw) : DEFAULT_EXERCISES;
      const localLogs: WorkoutLog[] = localLogsRaw ? JSON.parse(localLogsRaw) : [];
      const localTemplates: WorkoutTemplate[] = localTemplatesRaw ? JSON.parse(localTemplatesRaw) : [];
      const parsedUnit: WeightUnit = localUnit ? JSON.parse(localUnit) : 'lbs';

      // Map old exercise IDs to new UUIDs
      const idMap = new Map<string, string>();

      // Insert exercises
      const exerciseRows = localExercises.map(e => {
        const newId = crypto.randomUUID();
        idMap.set(e.id, newId);
        return {
          id: newId,
          user_id: user.id,
          name: e.name,
          muscle_group: e.muscleGroup,
          equipment: e.equipment,
        };
      });

      if (exerciseRows.length > 0) {
        await supabase.from('exercises').insert(exerciseRows);
      }

      // Remap exercise IDs in logs
      const logRows = localLogs.map(log => ({
        user_id: user.id,
        name: log.name,
        date: log.date,
        duration: log.duration,
        exercises: JSON.parse(JSON.stringify(log.exercises.map(e => ({
          ...e,
          exerciseId: idMap.get(e.exerciseId) || e.exerciseId,
        })))) as Json,
      }));

      if (logRows.length > 0) {
        await supabase.from('workout_logs').insert(logRows);
      }

      // Remap template exercise IDs
      const templateRows = localTemplates.map(t => ({
        user_id: user.id,
        name: t.name,
        exercise_ids: t.exerciseIds.map(id => idMap.get(id) || id),
      }));

      if (templateRows.length > 0) {
        await supabase.from('workout_templates').insert(templateRows);
      }

      // Update unit
      if (parsedUnit !== 'lbs') {
        await supabase.from('profiles').update({ weight_unit: parsedUnit }).eq('user_id', user.id);
      }

      // Clear localStorage workout data
      localStorage.removeItem('exercises');
      localStorage.removeItem('workoutLogs');
      localStorage.removeItem('workoutTemplates');
      localStorage.removeItem('weightUnit');

      toast.success(`Migrated ${localLogs.length} workouts to the cloud!`);

      // Reload
      await loadFromCloud();
    } catch (err) {
      console.error('Migration failed:', err);
      toast.error('Failed to migrate local data');
      setLoading(false);
    }
  };

  // Keep active workout in localStorage (ephemeral, not in DB)
  useEffect(() => {
    if (activeWorkout) {
      localStorage.setItem('activeWorkout', JSON.stringify(activeWorkout));
    } else {
      localStorage.removeItem('activeWorkout');
    }
  }, [activeWorkout]);

  const addExercise = useCallback(async (exercise: Omit<Exercise, 'id'>) => {
    if (!user) return;
    const newId = crypto.randomUUID();
    const newExercise = { ...exercise, id: newId };
    setExercises(prev => [...prev, newExercise]);
    await supabase.from('exercises').insert({
      id: newId,
      user_id: user.id,
      name: exercise.name,
      muscle_group: exercise.muscleGroup,
      equipment: exercise.equipment,
    });
  }, [user]);

  const deleteExercise = useCallback(async (id: string) => {
    setExercises(prev => prev.filter(e => e.id !== id));
    await supabase.from('exercises').delete().eq('id', id);
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
    if (!user) return;
    const { data } = await supabase.from('workout_templates').insert({
      user_id: user.id,
      name,
      exercise_ids: exerciseIds,
    }).select().single();
    if (data) {
      setTemplates(prev => [...prev, { id: data.id, name: data.name, exerciseIds: data.exercise_ids }]);
    }
  }, [user]);

  const deleteTemplate = useCallback(async (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
    await supabase.from('workout_templates').delete().eq('id', id);
  }, []);

  const addExerciseToWorkout = useCallback((exerciseId: string) => {
    setActiveWorkout(prev => {
      if (!prev || prev.exercises.some(e => e.exerciseId === exerciseId)) return prev;
      return { ...prev, exercises: [{ exerciseId, sets: [] }, ...prev.exercises] };
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
          const newSet: SetData = { id: generateId(), setNumber: e.sets.length + 1, weight: 0, reps: 0 };
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
          return { ...e, sets: e.sets.map(s => s.id === setId ? { ...s, [field]: value } : s) };
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
    if (!activeWorkout || !user) return;
    const exercisesWithSets = activeWorkout.exercises.filter(e => e.sets.length > 0);
    const duration = Math.round((Date.now() - new Date(activeWorkout.startedAt).getTime()) / 60000);

    const { data } = await supabase.from('workout_logs').insert({
      user_id: user.id,
      name: activeWorkout.name,
      date: new Date().toISOString(),
      duration,
      exercises: exercisesWithSets as unknown as any,
    }).select().single();

    if (data) {
      const log: WorkoutLog = {
        id: data.id,
        name: data.name,
        date: data.date,
        duration: data.duration,
        exercises: data.exercises as unknown as WorkoutExercise[],
      };
      setWorkoutLogs(prev => [log, ...prev]);
    }
    setActiveWorkout(null);
  }, [activeWorkout, user]);

  const cancelWorkout = useCallback(() => {
    setActiveWorkout(null);
  }, []);

  const toggleUnit = useCallback(async () => {
    const convert = (value: number, toKg: boolean) =>
      Math.round((toKg ? value * LBS_TO_KG : value * KG_TO_LBS) * 10) / 10;

    setUnit(prev => {
      const toKg = prev === 'lbs';
      const newUnit = toKg ? 'kg' : 'lbs';

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

      setWorkoutLogs(logs =>
        logs.map(log => ({
          ...log,
          exercises: log.exercises.map(e => ({
            ...e,
            sets: e.sets.map(s => ({ ...s, weight: convert(s.weight, toKg) })),
          })),
        }))
      );

      // Update in DB
      if (user) {
        supabase.from('profiles').update({ weight_unit: newUnit }).eq('user_id', user.id);
      }

      return newUnit;
    });
  }, [user]);

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

  const importData = useCallback(async (data: { exercises?: Exercise[]; workoutLogs?: WorkoutLog[]; templates?: WorkoutTemplate[]; unit?: WeightUnit }) => {
    if (!user) return;

    // Import exercises with ID mapping
    const idMap = new Map<string, string>();
    if (data.exercises) {
      const rows = data.exercises.map(e => {
        const newId = crypto.randomUUID();
        idMap.set(e.id, newId);
        return { id: newId, user_id: user.id, name: e.name, muscle_group: e.muscleGroup, equipment: e.equipment };
      });
      await supabase.from('exercises').insert(rows);
      setExercises(prev => [...prev, ...data.exercises!.map((e, i) => ({ ...e, id: rows[i].id }))]);
    }

    if (data.workoutLogs) {
      const rows = data.workoutLogs.map(log => ({
        user_id: user.id,
        name: log.name,
        date: log.date,
        duration: log.duration,
        exercises: JSON.parse(JSON.stringify(log.exercises.map(e => ({ ...e, exerciseId: idMap.get(e.exerciseId) || e.exerciseId })))) as Json,
      }));
      const { data: inserted } = await supabase.from('workout_logs').insert(rows).select();
      if (inserted) {
        setWorkoutLogs(prev => [
          ...inserted.map(l => ({
            id: l.id, name: l.name, date: l.date, duration: l.duration,
            exercises: l.exercises as unknown as WorkoutExercise[],
          })),
          ...prev,
        ]);
      }
    }

    if (data.templates) {
      const rows = data.templates.map(t => ({
        user_id: user.id,
        name: t.name,
        exercise_ids: t.exerciseIds.map(id => idMap.get(id) || id),
      }));
      const { data: inserted } = await supabase.from('workout_templates').insert(rows).select();
      if (inserted) {
        setTemplates(prev => [...prev, ...inserted.map(t => ({ id: t.id, name: t.name, exerciseIds: t.exercise_ids }))]);
      }
    }

    if (data.unit) {
      setUnit(data.unit);
      await supabase.from('profiles').update({ weight_unit: data.unit }).eq('user_id', user.id);
    }
  }, [user]);

  const exportData = useCallback(() => ({
    exercises, workoutLogs, templates, unit,
  }), [exercises, workoutLogs, templates, unit]);

  return (
    <WorkoutContext.Provider value={{
      exercises, workoutLogs, activeWorkout, unit, templates, loading,
      addExercise, deleteExercise, startWorkout, startWorkoutFromTemplate,
      addExerciseToWorkout, removeExerciseFromWorkout,
      addSet, updateSet, removeSet, reorderExercise,
      finishWorkout, cancelWorkout, toggleUnit,
      getLastRecord, getExerciseById, getExerciseHistory,
      saveAsTemplate, deleteTemplate, importData, exportData,
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
