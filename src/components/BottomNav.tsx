import { Home, Dumbbell, Play, TrendingUp, ClipboardList } from 'lucide-react';

export type TabId = 'dashboard' | 'exercises' | 'workout' | 'history' | 'progress';

interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  hasActiveWorkout: boolean;
}

const tabs: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: 'dashboard', label: 'Home', icon: Home },
  { id: 'exercises', label: 'Exercises', icon: Dumbbell },
  { id: 'workout', label: 'Workout', icon: Play },
  { id: 'history', label: 'History', icon: ClipboardList },
  { id: 'progress', label: 'Progress', icon: TrendingUp },
];

export default function BottomNav({ activeTab, onTabChange, hasActiveWorkout }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center gap-0.5 px-4 py-2 relative ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
              {tab.id === 'workout' && hasActiveWorkout && (
                <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-warning" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
