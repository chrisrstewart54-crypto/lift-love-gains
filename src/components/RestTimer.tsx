import { useState, useEffect, useCallback, useRef } from 'react';
import { Timer, X, Plus, Minus, Volume2, VolumeX } from 'lucide-react';

const REST_PRESETS = [60, 90, 120, 180];

function playBeep(frequency = 880, duration = 0.15, volume = 0.3) {
  try {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    gain.gain.value = volume;
    oscillator.start();
    oscillator.stop(ctx.currentTime + duration);
  } catch {}
}

function playFinishBeep() {
  playBeep(880, 0.15, 0.3);
  setTimeout(() => playBeep(1100, 0.2, 0.3), 200);
}

function playCountdownTick(secondsLeft: number) {
  const countdownEnabled = localStorage.getItem('countdownEnabled');
  if (countdownEnabled === 'false') return;
  const freq = secondsLeft === 0 ? 1100 : 660;
  const dur = secondsLeft === 0 ? 0.25 : 0.1;
  playBeep(freq, dur, 0.25);
}

function vibrate() {
  try {
    const vibEnabled = localStorage.getItem('vibrationEnabled');
    if (vibEnabled === 'false') return;
    navigator.vibrate?.([200, 100, 200]);
  } catch {}
}

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
  const [alertEnabled, setAlertEnabled] = useState(() => {
    return localStorage.getItem('restTimerAlert') !== 'off';
  });
  const alertFired = useRef(false);

  useEffect(() => {
    localStorage.setItem('restTimerDuration', String(duration));
  }, [duration]);

  useEffect(() => {
    localStorage.setItem('restTimerAlert', alertEnabled ? 'on' : 'off');
  }, [alertEnabled]);

  useEffect(() => {
    setRemaining(duration);
    setIsRunning(true);
    alertFired.current = false;
  }, [duration]);

  useEffect(() => {
    if (!isRunning || remaining <= 0) return;
    const interval = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          setIsRunning(false);
          if (alertEnabled && !alertFired.current) {
            alertFired.current = true;
            playFinishBeep();
            vibrate();
          }
          return 0;
        }
        // Play countdown tick for last 5 seconds
        if (alertEnabled && prev <= 6) {
          playCountdownTick(prev - 1);
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning, remaining, alertEnabled]);

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

        {/* Alert toggle + Duration presets */}
        {!isDone && (
          <div className="flex gap-2 mt-3 items-center">
            <button
              onClick={() => setAlertEnabled(prev => !prev)}
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                alertEnabled ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
              }`}
              title={alertEnabled ? 'Alert on' : 'Alert off'}
            >
              {alertEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>
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
