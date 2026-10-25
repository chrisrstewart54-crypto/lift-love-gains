import { describe, expect, it } from 'vitest';
import { isSummaryDue, summaryWindowStart } from '../../supabase/functions/send-weekly-summary/summary-window';

describe('weekly summary delivery', () => {
  it('includes Monday and Saturday workouts in Sunday evening summaries', () => {
    const now = new Date('2026-10-25T18:00:00Z');
    const start = summaryWindowStart(now);
    expect(start.toISOString()).toBe('2026-10-18T18:00:00.000Z');
    expect(new Date('2026-10-19T17:31:37.096Z') >= start).toBe(true);
    expect(new Date('2026-10-24T10:04:50.435Z') >= start).toBe(true);
    expect(new Date('2026-10-17T09:48:21.363Z') >= start).toBe(false);
  });

  it('retries a missed Sunday 8 PM delivery later that Sunday, never early', () => {
    expect(isSummaryDue(0, 21, 0, 20)).toBe(true);
    expect(isSummaryDue(0, 19, 0, 20)).toBe(false);
    expect(isSummaryDue(1, 21, 0, 20)).toBe(false);
  });
});