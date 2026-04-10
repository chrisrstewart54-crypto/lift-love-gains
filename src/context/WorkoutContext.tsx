import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Exercise, WorkoutLog, ActiveWorkout, WeightUnit, SetData, WorkoutExercise, WorkoutTemplate, DEFAULT_EXERCISES } from '@/types/workout';

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
  importData: (data: { exercises?: Exercise[]; workoutLogs?: WorkoutLog[]; templates?: WorkoutTemplate[]; unit?: WeightUnit }) => void;
  exportData: () => { exercises: Exercise[]; workoutLogs: WorkoutLog[]; templates: WorkoutTemplate[]; unit: WeightUnit };
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
  const [exercises, setExercises] = useState<Exercise[]>(() => loadFromStorage('exercises', DEFAULT_EXERCISES));
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>(() => loadFromStorage('workoutLogs', []));
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(() => loadFromStorage('activeWorkout', null));
  const [unit, setUnit] = useState<WeightUnit>(() => loadFromStorage('weightUnit', 'lbs'));
  const [templates, setTemplates] = useState<WorkoutTemplate[]>(() => loadFromStorage('workoutTemplates', []));

  useEffect(() => saveToStorage('exercises', exercises), [exercises]);
  useEffect(() => saveToStorage('workoutLogs', workoutLogs), [workoutLogs]);
  useEffect(() => saveToStorage('activeWorkout', activeWorkout), [activeWorkout]);
  useEffect(() => saveToStorage('weightUnit', unit), [unit]);
  useEffect(() => saveToStorage('workoutTemplates', templates), [templates]);

  const addExercise = useCallback((exercise: Omit<Exercise, 'id'>) => {
    setExercises(prev => [...prev, { ...exercise, id: generateId() }]);
  }, []);

  const deleteExercise = useCallback((id: string) => {
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

  const saveAsTemplate = useCallback((name: string, exerciseIds: string[]) => {
    setTemplates(prev => [...prev, { id: generateId(), name, exerciseIds }]);
  }, []);

  const deleteTemplate = useCallback((id: string) => {
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

  const finishWorkout = useCallback(() => {
    if (!activeWorkout) return;
    const exercisesWithSets = activeWorkout.exercises.filter(e => e.sets.length > 0);
    const log: WorkoutLog = {
      id: generateId(),
      name: activeWorkout.name,
      date: new Date().toISOString(),
      exercises: exercisesWithSets,
      duration: Math.round((Date.now() - new Date(activeWorkout.startedAt).getTime()) / 60000),
    };
    setWorkoutLogs(prev => [log, ...prev]);
    setActiveWorkout(null);
  }, [activeWorkout]);

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

      // Convert logs
      setWorkoutLogs(logs =>
        logs.map(log => ({
          ...log,
          exercises: log.exercises.map(e => ({
            ...e,
            sets: e.sets.map(s => ({ ...s, weight: convert(s.weight, toKg) })),
          })),
        }))
      );

      return newUnit;
    });
  }, []);

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

  const importData = useCallback((data: { exercises?: Exercise[]; workoutLogs?: WorkoutLog[]; templates?: WorkoutTemplate[]; unit?: WeightUnit }) => {
    if (data.exercises) setExercises(data.exercises);
    if (data.workoutLogs) setWorkoutLogs(prev => [...data.workoutLogs!, ...prev]);
    if (data.templates) setTemplates(prev => [...data.templates!, ...prev]);
    if (data.unit) setUnit(data.unit);
  }, []);

  const exportData = useCallback(() => ({
    exercises, workoutLogs, templates, unit,
  }), [exercises, workoutLogs, templates, unit]);

  return (
    <WorkoutContext.Provider value={{
      exercises, workoutLogs, activeWorkout, unit, templates,
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
