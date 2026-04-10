import { Capacitor } from '@capacitor/core';

// Types for Health Connect integration
export type HealthConnectAvailability = 'Available' | 'NotSupported' | 'NotInstalled';

export interface HealthConnectStatus {
  available: boolean;
  availability: HealthConnectAvailability;
  hasPermissions: boolean;
}

export interface HealthConnectExerciseSession {
  startTime: string;
  endTime: string;
  title?: string;
  type?: string;
}

/**
 * Check if we're running on a native Android platform
 */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

/**
 * Lazily import the plugin only when on native
 */
async function getPlugin() {
  const { HealthConnect } = await import('@devmaxime/capacitor-health-connect');
  return HealthConnect;
}

/**
 * Check Health Connect availability and permission status
 */
export async function checkHealthConnectStatus(): Promise<HealthConnectStatus> {
  if (!isNativePlatform()) {
    return { available: false, availability: 'NotSupported', hasPermissions: false };
  }

  try {
    const plugin = await getPlugin();
    const { availability } = await plugin.checkAvailability();

    if (availability !== 'Available') {
      return { available: false, availability, hasPermissions: false };
    }

    const granted = await plugin.getGrantedPermissions();
    const hasRead = granted.read?.includes('ActivitySession') ?? false;

    return { available: true, availability, hasPermissions: hasRead };
  } catch (err) {
    console.error('Health Connect status check failed:', err);
    return { available: false, availability: 'NotSupported', hasPermissions: false };
  }
}

/**
 * Request read/write permissions for exercise and weight data
 */
export async function requestHealthConnectPermissions(): Promise<boolean> {
  if (!isNativePlatform()) return false;

  try {
    const plugin = await getPlugin();
    const result = await plugin.requestPermissions({
      read: ['ActivitySession', 'Weight'],
      write: ['ActivitySession', 'Weight'],
    });
    return result.read?.includes('ActivitySession') ?? false;
  } catch (err) {
    console.error('Health Connect permission request failed:', err);
    return false;
  }
}

/**
 * Revoke all Health Connect permissions
 */
export async function revokeHealthConnectPermissions(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    const plugin = await getPlugin();
    await plugin.revokePermissions();
  } catch (err) {
    console.error('Health Connect revoke failed:', err);
  }
}

/**
 * Read exercise sessions from Health Connect within a date range
 */
export async function readExerciseSessions(
  startDate: Date,
  endDate: Date
): Promise<HealthConnectExerciseSession[]> {
  if (!isNativePlatform()) return [];

  try {
    const plugin = await getPlugin();
    const result = await plugin.readRecords({
      type: 'ActivitySession',
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    });
    return (result.records ?? []).map((r: any) => ({
      startTime: r.startTime ?? r.startZoneOffset ?? '',
      endTime: r.endTime ?? r.endZoneOffset ?? '',
      title: r.title ?? r.notes ?? 'Workout',
      type: r.exerciseType ?? 'unknown',
    }));
  } catch (err) {
    console.error('Health Connect read exercise sessions failed:', err);
    return [];
  }
}

/**
 * Read weight records from Health Connect within a date range
 */
export async function readWeightRecords(
  startDate: Date,
  endDate: Date
): Promise<{ time: string; weightKg: number }[]> {
  if (!isNativePlatform()) return [];

  try {
    const plugin = await getPlugin();
    const result = await plugin.readRecords({
      type: 'Weight',
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    });
    return (result.records ?? []).map((r: any) => ({
      time: r.time ?? '',
      weightKg: r.weight?.inKilograms ?? r.weight ?? 0,
    }));
  } catch (err) {
    console.error('Health Connect read weight failed:', err);
    return [];
  }
}
