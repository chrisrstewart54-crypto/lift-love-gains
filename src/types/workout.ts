export type MuscleGroup = 
  | 'Chest' | 'Back' | 'Shoulders' | 'Biceps' | 'Triceps' 
  | 'Legs' | 'Glutes' | 'Core' | 'Forearms' | 'Calves' | 'Full Body' | 'Cardio';

export type Equipment = 
  | 'Barbell' | 'Dumbbell' | 'Machine' | 'Cable' | 'Bodyweight' 
  | 'Kettlebell' | 'Bands' | 'Cardio Machine' | 'Other';

export function isCardioExercise(exercise?: { muscleGroup?: string; equipment?: string } | null): boolean {
  if (!exercise) return false;
  return exercise.muscleGroup === 'Cardio' || exercise.equipment === 'Cardio Machine';
}

export type WeightUnit = 'lbs' | 'kg';

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
}

export interface SetData {
  id: string;
  setNumber: number;
  weight: number;
  reps: number;
  duration?: number; // minutes (cardio)
  distance?: number; // distance in user's distance unit (cardio)
}

export interface WorkoutExercise {
  exerciseId: string;
  sets: SetData[];
}

export interface WorkoutLog {
  id: string;
  name: string;
  date: string; // ISO string
  exercises: WorkoutExercise[];
  duration?: number; // minutes
}

export interface ActiveWorkout {
  name: string;
  exercises: WorkoutExercise[];
  startedAt: string;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  exerciseIds: string[];
}

// Helper to calculate volume with dumbbell multiplier (2x weight for dumbbells). Cardio returns 0.
export function calculateSetVolume(weight: number, reps: number, equipment?: string): number {
  if (equipment === 'Cardio Machine') return 0;
  const multiplier = equipment === 'Dumbbell' ? 2 : 1;
  return weight * reps * multiplier;
}

export const MUSCLE_GROUPS: MuscleGroup[] = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps',
  'Legs', 'Glutes', 'Core', 'Forearms', 'Calves', 'Full Body', 'Cardio'
];

export const EQUIPMENT_TYPES: Equipment[] = [
  'Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight',
  'Kettlebell', 'Bands', 'Cardio Machine', 'Other'
];

export const DEFAULT_CARDIO_EXERCISES: Omit<Exercise, 'id'>[] = [
  { name: 'Treadmill', muscleGroup: 'Cardio', equipment: 'Cardio Machine' },
  { name: 'Rowing Machine', muscleGroup: 'Cardio', equipment: 'Cardio Machine' },
  { name: 'Elliptical Trainer', muscleGroup: 'Cardio', equipment: 'Cardio Machine' },
  { name: 'Exercise Bike', muscleGroup: 'Cardio', equipment: 'Cardio Machine' },
];

export const DEFAULT_EXERCISES: Exercise[] = [
  { id: '1', name: 'Bench Press', muscleGroup: 'Chest', equipment: 'Barbell' },
  { id: '2', name: 'Incline Dumbbell Press', muscleGroup: 'Chest', equipment: 'Dumbbell' },
  { id: '3', name: 'Cable Flyes', muscleGroup: 'Chest', equipment: 'Cable' },
  { id: '4', name: 'Push Ups', muscleGroup: 'Chest', equipment: 'Bodyweight' },
  { id: '5', name: 'Deadlift', muscleGroup: 'Back', equipment: 'Barbell' },
  { id: '6', name: 'Pull Ups', muscleGroup: 'Back', equipment: 'Bodyweight' },
  { id: '7', name: 'Barbell Row', muscleGroup: 'Back', equipment: 'Barbell' },
  { id: '8', name: 'Lat Pulldown', muscleGroup: 'Back', equipment: 'Cable' },
  { id: '9', name: 'Overhead Press', muscleGroup: 'Shoulders', equipment: 'Barbell' },
  { id: '10', name: 'Lateral Raises', muscleGroup: 'Shoulders', equipment: 'Dumbbell' },
  { id: '11', name: 'Barbell Curl', muscleGroup: 'Biceps', equipment: 'Barbell' },
  { id: '12', name: 'Hammer Curl', muscleGroup: 'Biceps', equipment: 'Dumbbell' },
  { id: '13', name: 'Tricep Pushdown', muscleGroup: 'Triceps', equipment: 'Cable' },
  { id: '14', name: 'Skull Crushers', muscleGroup: 'Triceps', equipment: 'Barbell' },
  { id: '15', name: 'Squat', muscleGroup: 'Legs', equipment: 'Barbell' },
  { id: '16', name: 'Leg Press', muscleGroup: 'Legs', equipment: 'Machine' },
  { id: '17', name: 'Romanian Deadlift', muscleGroup: 'Legs', equipment: 'Barbell' },
  { id: '18', name: 'Leg Curl', muscleGroup: 'Legs', equipment: 'Machine' },
  { id: '19', name: 'Calf Raises', muscleGroup: 'Calves', equipment: 'Machine' },
  { id: '20', name: 'Plank', muscleGroup: 'Core', equipment: 'Bodyweight' },
  { id: '21', name: 'Hip Thrust', muscleGroup: 'Glutes', equipment: 'Barbell' },
  { id: '22', name: 'Treadmill', muscleGroup: 'Cardio', equipment: 'Cardio Machine' },
  { id: '23', name: 'Rowing Machine', muscleGroup: 'Cardio', equipment: 'Cardio Machine' },
  { id: '24', name: 'Elliptical Trainer', muscleGroup: 'Cardio', equipment: 'Cardio Machine' },
  { id: '25', name: 'Exercise Bike', muscleGroup: 'Cardio', equipment: 'Cardio Machine' },
];
