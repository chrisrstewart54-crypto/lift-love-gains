import { useState, useCallback } from 'react';
import { WorkoutProvider, useWorkout } from '@/context/WorkoutContext';
import { useAuth } from '@/context/AuthContext';
import BottomNav, { TabId } from '@/components/BottomNav';
import DashboardView from '@/components/DashboardView';
import ExerciseManagerView from '@/components/ExerciseManagerView';
import ActiveWorkoutView from '@/components/ActiveWorkoutView';
import HistoryView from '@/components/HistoryView';
import ProgressView from '@/components/ProgressView';
import SettingsView from '@/components/SettingsView';
import Auth from '@/pages/Auth';
import { useWeeklyNotification } from '@/hooks/useWeeklyNotification';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const { activeWorkout, workoutLogs, getExerciseById, loading } = useWorkout();

  const getExerciseName = useCallback((id: string) => getExerciseById(id)?.name, [getExerciseById]);
  useWeeklyNotification(workoutLogs, getExerciseName);

  const handleStartWorkout = () => setActiveTab('workout');
  const handleFinishWorkout = () => setActiveTab('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background max-w-lg mx-auto">
      {activeTab === 'dashboard' && <DashboardView onStartWorkout={handleStartWorkout} />}
      {activeTab === 'exercises' && <ExerciseManagerView />}
      {activeTab === 'workout' && <ActiveWorkoutView onFinish={handleFinishWorkout} />}
      {activeTab === 'history' && <HistoryView />}
      {activeTab === 'progress' && <ProgressView />}
      {activeTab === 'settings' && <SettingsView />}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} hasActiveWorkout={!!activeWorkout} />
    </div>
  );
}

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <WorkoutProvider>
      <AppContent />
    </WorkoutProvider>
  );
}
