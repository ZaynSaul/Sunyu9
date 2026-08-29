import { MIGRATION } from '@/constants/numbering';
import { daysUntil, formatPlanDate, getDeadline } from '../deadline';

const asDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

describe('formatPlanDate', () => {
  it('renders an ISO date in the plan style', () => {
    expect(formatPlanDate('2026-11-30')).toBe('30 Nov 2026');
    expect(formatPlanDate('2026-09-04')).toBe('4 Sep 2026');
  });

  it('passes through anything it cannot parse', () => {
    expect(formatPlanDate('soon')).toBe('soon');
  });
});

describe('daysUntil', () => {
  it('counts whole days and goes negative once passed', () => {
    expect(daysUntil('2026-09-04', asDate('2026-08-29'))).toBe(6);
    expect(daysUntil('2026-09-04', asDate('2026-09-04'))).toBe(0);
    expect(daysUntil('2026-09-04', asDate('2026-09-10'))).toBe(-6);
  });
});

describe('getDeadline', () => {
  it('before the dual-run window: counts down to the start, no progress', () => {
    const d = getDeadline(asDate('2026-08-29'));
    expect(d.phase).toBe('before-dual-run');
    expect(d.headline).toBe('6 days');
    expect(d.windowProgress).toBe(0);
  });

  it('during dual-run: counts down to the cutoff, progress advances', () => {
    const d = getDeadline(asDate('2026-10-18'));
    expect(d.phase).toBe('dual-run');
    expect(d.daysToCutoff).toBe(43);
    expect(d.windowProgress).toBeGreaterThan(0);
    expect(d.windowProgress).toBeLessThan(1);
  });

  it('progress is monotonic across the window and clamps to [0, 1]', () => {
    const start = getDeadline(asDate(MIGRATION.dualRunStart)).windowProgress;
    const mid = getDeadline(asDate('2026-10-18')).windowProgress;
    const end = getDeadline(asDate(MIGRATION.sevenDigitCutoff)).windowProgress;
    const after = getDeadline(asDate('2027-01-01')).windowProgress;

    expect(start).toBe(0);
    expect(mid).toBeGreaterThan(start);
    expect(end).toBeGreaterThanOrEqual(mid);
    expect(end).toBe(1);
    expect(after).toBe(1);
  });

  it('after the cutoff: retired phase', () => {
    const d = getDeadline(asDate('2026-12-25'));
    expect(d.phase).toBe('retired');
    expect(d.windowProgress).toBe(1);
  });
});
