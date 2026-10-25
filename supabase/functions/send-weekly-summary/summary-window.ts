// A summary covers the seven days preceding delivery, not the new Sunday week.
export function summaryWindowStart(now = new Date()): Date {
  return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
}

export function isSummaryDue(day: number, hour: number, scheduledDay: number, scheduledHour: number): boolean {
  return day === scheduledDay && hour >= scheduledHour;
}