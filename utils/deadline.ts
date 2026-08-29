/**
 * Shared migration-deadline maths so every screen shows the same countdown.
 * Pure — no native imports.
 */
import { MIGRATION } from '@/constants/numbering';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** `2026-11-30` -> `30 Nov 2026`. */
export function formatPlanDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Whole days from today until an ISO date (negative once it has passed). */
export function daysUntil(iso: string, now = new Date()): number {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(y, (m ?? 1) - 1, d ?? 1).getTime();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((target - midnight) / 86_400_000);
}

/** Local `Date` at midnight for an ISO `yyyy-mm-dd` string. */
function dateOnly(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

export type MigrationPhase = 'before-dual-run' | 'dual-run' | 'retired';

export interface Deadline {
  phase: MigrationPhase;
  /** Bold lead-in, e.g. `6 days` or `83 days left`. */
  headline: string;
  /** Sentence that finishes the headline. */
  caption: string;
  /** Single-line version for a compact strip. */
  strip: string;
  daysToDualRun: number;
  daysToCutoff: number;
  /**
   * How far through the dual-run window we are: `0` before it opens,
   * `1` once the 7-digit cutoff is reached. Drives the countdown progress bar.
   */
  windowProgress: number;
  dualRunStartLabel: string;
  cutoffLabel: string;
}

export function getDeadline(now = new Date()): Deadline {
  const daysToDualRun = daysUntil(MIGRATION.dualRunStart, now);
  const daysToCutoff = daysUntil(MIGRATION.sevenDigitCutoff, now);
  const dualRunStartLabel = formatPlanDate(MIGRATION.dualRunStart);
  const cutoffLabel = formatPlanDate(MIGRATION.sevenDigitCutoff);

  // Whole length of the dual-run window, measured from its own start date.
  const windowDays = daysUntil(MIGRATION.sevenDigitCutoff, dateOnly(MIGRATION.dualRunStart));
  const windowProgress =
    windowDays > 0 ? clamp01((windowDays - daysToCutoff) / windowDays) : daysToCutoff > 0 ? 0 : 1;

  const base = { daysToDualRun, daysToCutoff, windowProgress, dualRunStartLabel, cutoffLabel };

  if (daysToDualRun > 0) {
    const d = `${daysToDualRun} ${daysToDualRun === 1 ? 'day' : 'days'}`;
    return {
      ...base,
      phase: 'before-dual-run',
      headline: d,
      caption: 'until the new 9-digit numbers switch on',
      strip: `${d} until 9-digit numbers switch on`,
    };
  }

  if (daysToCutoff > 0) {
    const d = `${daysToCutoff} ${daysToCutoff === 1 ? 'day' : 'days'} left`;
    return {
      ...base,
      phase: 'dual-run',
      headline: d,
      caption: `to update before 7-digit numbers stop working on ${cutoffLabel}`,
      strip: `${d} — 7-digit numbers stop ${cutoffLabel}`,
    };
  }

  return {
    ...base,
    phase: 'retired',
    headline: '7-digit numbers have retired',
    caption: 'only 9-digit numbers connect now',
    strip: '7-digit numbers no longer work — only 9-digit numbers connect',
  };
}
