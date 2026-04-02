import { useState } from 'react';
import { WorkoutProvider, useWorkout } from '@/context/WorkoutContext';
import BottomNav, { TabId } from '@/components/BottomNav';
import DashboardView from '@/components/DashboardView';
import ExerciseManagerView from '@/components/ExerciseManagerView';
import ActiveWorkoutView from '@/components/ActiveWorkoutView';
import HistoryView from '@/components/HistoryView';
import ProgressView from '@/components/ProgressView';

function AppContent() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const { activeWorkout } = useWorkout();

  const handleStartWorkout = () => setActiveTab('workout');
  const handleFinishWorkout = () => setActiveTab('dashboard');

  return (
    <div className="min-h-screen bg-background max-w-lg mx-auto">
      {activeTab === 'dashboard' && <DashboardView onStartWorkout={handleStartWorkout} />}
      {activeTab === 'exercises' && <ExerciseManagerView />}
      {activeTab === 'workout' && <ActiveWorkoutView onFinish={handleFinishWorkout} />}
      {activeTab === 'history' && <HistoryView />}
      {activeTab === 'progress' && <ProgressView />}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} hasActiveWorkout={!!activeWorkout} />
    </div>
  );
}

export default function Index() {
  return (
    <WorkoutProvider>
      <AppContent />
    </WorkoutProvider>
  );
}
