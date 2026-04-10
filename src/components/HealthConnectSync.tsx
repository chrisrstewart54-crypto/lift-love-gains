import { useState, useEffect, useCallback } from 'react';
import { Smartphone, RefreshCw, Shield, ShieldOff, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  isNativePlatform,
  checkHealthConnectStatus,
  requestHealthConnectPermissions,
  revokeHealthConnectPermissions,
  readExerciseSessions,
  type HealthConnectStatus,
} from '@/services/healthConnect';

type SyncState = 'idle' | 'syncing' | 'success' | 'error';

export default function HealthConnectSync() {
  const [status, setStatus] = useState<HealthConnectStatus | null>(null);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [lastSynced, setLastSynced] = useState<string | null>(() =>
    localStorage.getItem('healthConnectLastSync')
  );
  const [importedCount, setImportedCount] = useState<number>(0);
  const isNative = isNativePlatform();

  const refreshStatus = useCallback(async () => {
    if (!isNative) return;
    const s = await checkHealthConnectStatus();
    setStatus(s);
  }, [isNative]);

  useEffect(() => { refreshStatus(); }, [refreshStatus]);

  const handleConnect = async () => {
    const granted = await requestHealthConnectPermissions();
    if (granted) await refreshStatus();
  };

  const handleDisconnect = async () => {
    await revokeHealthConnectPermissions();
    await refreshStatus();
    localStorage.removeItem('healthConnectLastSync');
    setLastSynced(null);
  };

  const handleSync = async () => {
    setSyncState('syncing');
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30); // last 30 days

      const sessions = await readExerciseSessions(start, end);
      setImportedCount(sessions.length);

      const now = new Date().toISOString();
      localStorage.setItem('healthConnectLastSync', now);
      setLastSynced(now);
      setSyncState('success');
      setTimeout(() => setSyncState('idle'), 3000);
    } catch {
      setSyncState('error');
      setTimeout(() => setSyncState('idle'), 3000);
    }
  };

  // Not on native Android — show informational message
  if (!isNative) {
    return (
      <section className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-foreground text-sm">Health Connect</h2>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              Health Connect sync is available when running as a native Android app. 
              Export this project to GitHub, build with Capacitor, and run on an Android device to enable syncing with Samsung Health.
            </p>
          </div>
        </div>
      </section>
    );
  }

  // Loading status
  if (!status) {
    return (
      <section className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-foreground text-sm">Health Connect</h2>
        </div>
        <div className="p-4">
          <p className="text-sm text-muted-foreground">Checking Health Connect…</p>
        </div>
      </section>
    );
  }

  // Not installed / not supported
  if (!status.available) {
    return (
      <section className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-foreground text-sm">Health Connect</h2>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              {status.availability === 'NotInstalled'
                ? 'Health Connect is not installed. Install it from the Google Play Store to sync with Samsung Health.'
                : 'Health Connect is not supported on this device.'}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Smartphone className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-foreground text-sm">Health Connect</h2>
      </div>
      <div className="p-4 space-y-4">
        {/* Connection status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {status.hasPermissions ? (
              <Shield className="w-4 h-4 text-green-500" />
            ) : (
              <ShieldOff className="w-4 h-4 text-muted-foreground" />
            )}
            <span className="text-sm text-foreground">
              {status.hasPermissions ? 'Connected' : 'Not connected'}
            </span>
          </div>
          {status.hasPermissions ? (
            <button
              onClick={handleDisconnect}
              className="text-xs px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive font-medium"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={handleConnect}
              className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium"
            >
              Connect
            </button>
          )}
        </div>

        {/* Sync controls */}
        {status.hasPermissions && (
          <>
            <button
              onClick={handleSync}
              disabled={syncState === 'syncing'}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncState === 'syncing' ? 'animate-spin' : ''}`} />
              {syncState === 'syncing' ? 'Syncing…' : 'Sync Now (Last 30 days)'}
            </button>

            {syncState === 'success' && (
              <div className="flex items-center gap-2 text-green-500 text-sm">
                <CheckCircle2 className="w-4 h-4" />
                <span>Synced {importedCount} session{importedCount !== 1 ? 's' : ''}</span>
              </div>
            )}

            {syncState === 'error' && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>Sync failed. Please try again.</span>
              </div>
            )}

            {lastSynced && (
              <p className="text-xs text-muted-foreground">
                Last synced: {new Date(lastSynced).toLocaleString()}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
