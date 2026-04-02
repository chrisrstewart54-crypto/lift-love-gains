import { useState, useEffect, useCallback } from 'react';
import { Timer, X, Plus, Minus } from 'lucide-react';

const REST_PRESETS = [60, 90, 120, 180];

interface RestTimerProps {
  onDismiss: () => void;
}

export default function RestTimer({ onDismiss }: RestTimerProps) {
  const [duration, setDuration] = useState(() => {
    const saved = localStorage.getItem('restTimerDuration');
    return saved ? Number(saved) : 90;
  });
  const [remaining, setRemaining] = useState(duration);
  const [isRunning, setIsRunning] = useState(true);

  useEffect(() => {
    localStorage.setItem('restTimerDuration', String(duration));
  }, [duration]);

  useEffect(() => {
    setRemaining(duration);
    setIsRunning(true);
  }, [duration]);

  useEffect(() => {
    if (!isRunning || remaining <= 0) return;
    const interval = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          setIsRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning, remaining]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const progress = duration > 0 ? ((duration - remaining) / duration) * 100 : 100;
  const isDone = remaining === 0;

  return (
    <div className="fixed bottom-16 left-0 right-0 z-40 flex justify-center px-4">
      <div className={`w-full max-w-lg rounded-xl border shadow-lg p-4 ${
        isDone ? 'bg-primary border-primary' : 'bg-card border-border'
      }`}>
        {/* Progress bar */}
        <div className="w-full h-1 bg-muted rounded-full mb-3 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-1000"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Timer className={`w-5 h-5 ${isDone ? 'text-primary-foreground' : 'text-primary'}`} />
            <span className={`text-2xl font-bold font-mono ${isDone ? 'text-primary-foreground' : 'text-foreground'}`}>
              {mins}:{secs.toString().padStart(2, '0')}
            </span>
            {isDone && (
              <span className="text-primary-foreground font-medium text-sm">Rest complete!</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {!isDone && (
              <>
                <button
                  onClick={() => setRemaining(prev => Math.max(0, prev - 15))}
                  className="w-8 h-8 rounded-lg bg-secondary text-secondary-foreground flex items-center justify-center"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setRemaining(prev => prev + 15)}
                  className="w-8 h-8 rounded-lg bg-secondary text-secondary-foreground flex items-center justify-center"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            <button
              onClick={onDismiss}
              className={`w-8 h-8 rounded-lg flex items-center justify-center ml-1 ${
                isDone ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-secondary text-secondary-foreground'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Duration presets */}
        {!isDone && (
          <div className="flex gap-2 mt-3">
            {REST_PRESETS.map(preset => (
              <button
                key={preset}
                onClick={() => { setDuration(preset); setRemaining(preset); setIsRunning(true); }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium ${
                  duration === preset
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground'
                }`}
              >
                {Math.floor(preset / 60)}:{(preset % 60).toString().padStart(2, '0')}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
