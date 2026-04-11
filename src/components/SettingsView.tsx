import { useState, useEffect, useRef } from 'react';
import { Settings, Bell, Timer, Volume2, Download, Upload, LogOut } from 'lucide-react';
import HealthConnectSync from './HealthConnectSync';
import { useWorkout } from '@/context/WorkoutContext';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const REST_PRESETS = [60, 90, 120, 180];

function loadSetting<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}

function saveSetting(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export default function SettingsView() {
  const { exportData, importData } = useWorkout();
  const { signOut, user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workout-history-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Workout data exported!');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        importData(data);
        toast.success(`Imported ${data.workoutLogs?.length ?? 0} workout logs!`);
      } catch {
        toast.error('Invalid file format');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const [notifDay, setNotifDay] = useState<number>(() => loadSetting('notifDay', 0));
  const [notifHour, setNotifHour] = useState<number>(() => loadSetting('notifHour', 20));
  const [notifEnabled, setNotifEnabled] = useState<boolean>(() => loadSetting('notifEnabled', true));
  const [defaultRestDuration, setDefaultRestDuration] = useState<number>(() => {
    const saved = localStorage.getItem('restTimerDuration');
    return saved ? Number(saved) : 90;
  });
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('restTimerAlert') !== 'off';
  });
  const [countdownEnabled, setCountdownEnabled] = useState<boolean>(() => loadSetting('countdownEnabled', true));
  const [vibrationEnabled, setVibrationEnabled] = useState<boolean>(() => loadSetting('vibrationEnabled', true));

  useEffect(() => { saveSetting('notifDay', notifDay); }, [notifDay]);
  useEffect(() => { saveSetting('notifHour', notifHour); }, [notifHour]);
  useEffect(() => { saveSetting('notifEnabled', notifEnabled); }, [notifEnabled]);
  useEffect(() => { localStorage.setItem('restTimerDuration', String(defaultRestDuration)); }, [defaultRestDuration]);
  useEffect(() => { localStorage.setItem('restTimerAlert', soundEnabled ? 'on' : 'off'); }, [soundEnabled]);
  useEffect(() => { saveSetting('countdownEnabled', countdownEnabled); }, [countdownEnabled]);
  useEffect(() => { saveSetting('vibrationEnabled', vibrationEnabled); }, [vibrationEnabled]);

  const formatHour = (h: number) => {
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hr = h % 12 || 12;
    return `${hr}:00 ${suffix}`;
  };

  const requestPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  };

  return (
    <div className="p-4 pb-24 space-y-6 animate-fade-in">
      <div className="flex items-center gap-2">
        <Settings className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
      </div>

      {/* Weekly Notification */}
      <section className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-foreground text-sm">Weekly Summary Notification</h2>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">Enabled</span>
            <button
              onClick={() => { setNotifEnabled(prev => !prev); if (!notifEnabled) requestPermission(); }}
              className={`w-12 h-7 rounded-full transition-colors relative ${notifEnabled ? 'bg-primary' : 'bg-muted'}`}
            >
              <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-foreground transition-transform ${notifEnabled ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>
          {notifEnabled && (
            <>
              <div>
                <label className="text-xs text-muted-foreground uppercase mb-1 block">Day</label>
                <select
                  value={notifDay}
                  onChange={e => setNotifDay(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-lg bg-muted text-foreground text-sm border-none"
                >
                  {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase mb-1 block">Time</label>
                <select
                  value={notifHour}
                  onChange={e => setNotifHour(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-lg bg-muted text-foreground text-sm border-none"
                >
                  {HOURS.map(h => <option key={h} value={h}>{formatHour(h)}</option>)}
                </select>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Rest Timer Defaults */}
      <section className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Timer className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-foreground text-sm">Rest Timer Defaults</h2>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground uppercase mb-2 block">Default Duration</label>
            <div className="flex gap-2">
              {REST_PRESETS.map(preset => (
                <button
                  key={preset}
                  onClick={() => setDefaultRestDuration(preset)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium ${
                    defaultRestDuration === preset
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {Math.floor(preset / 60)}:{(preset % 60).toString().padStart(2, '0')}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Sound & Vibration */}
      <section className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-foreground text-sm">Sound & Vibration</h2>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">Rest timer sound</span>
            <button
              onClick={() => setSoundEnabled(prev => !prev)}
              className={`w-12 h-7 rounded-full transition-colors relative ${soundEnabled ? 'bg-primary' : 'bg-muted'}`}
            >
              <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-foreground transition-transform ${soundEnabled ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">5-second countdown beeps</span>
            <button
              onClick={() => setCountdownEnabled(prev => !prev)}
              className={`w-12 h-7 rounded-full transition-colors relative ${countdownEnabled ? 'bg-primary' : 'bg-muted'}`}
            >
              <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-foreground transition-transform ${countdownEnabled ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">Vibration alerts</span>
            <button
              onClick={() => setVibrationEnabled(prev => !prev)}
              className={`w-12 h-7 rounded-full transition-colors relative ${vibrationEnabled ? 'bg-primary' : 'bg-muted'}`}
            >
              <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-foreground transition-transform ${vibrationEnabled ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>
        </div>
      </section>

      {/* Import / Export */}
      <section className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Download className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-foreground text-sm">Import / Export Data</h2>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-muted-foreground">Back up your workout history as a JSON file, or import a previous backup.</p>
          <div className="flex gap-3">
            <button
              onClick={handleExport}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
            >
              <Download className="w-4 h-4" /> Export
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-muted text-foreground text-sm font-medium"
            >
              <Upload className="w-4 h-4" /> Import
            </button>
            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          </div>
        </div>
      </section>

      {/* Health Connect */}
      <HealthConnectSync />

      {/* Account */}
      <section className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <LogOut className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-foreground text-sm">Account</h2>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-muted-foreground">Signed in as {user?.email}</p>
          <button
            onClick={signOut}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </section>
    </div>
  );
}
