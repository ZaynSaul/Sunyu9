/**
 * Pure planning for a migration run — no native calls.
 *
 * The planner only decides *which numbers on which contacts* the user wants
 * converted, as `{ from, to }` pairs. It deliberately does NOT rebuild each
 * contact's phone list: `contactUpdater` does that from a fresh read at write
 * time, so a contact edited (or an id rotated by an OS sync) between the scan
 * and the confirmation can't make us write a stale list.
 */
import type {
  AnalyzedContact,
  ContactAnalysis,
} from '@/services/contacts/contactAnalyzer';

/**
 * How the run treats each selected number.
 *  - `replace` — one `{from,to}` per selected row (NOT de-duped: picking one of
 *    two identical rows converts exactly one).
 *  - `add`     — keep the old number, add the new one. De-duped by value per
 *    contact (a second identical old row would only produce a duplicate new
 *    row), and rows whose 9-digit twin is already saved are skipped.
 */
export type ConversionMode = 'replace' | 'add';

const norm = (value: string): string => value.trim();

/** One number the user picked, as stored on the device → its converted form. */
export interface NumberConversion {
  /** The number exactly as it is stored on the contact today. */
  from: string;
  /** What it should become (grouped, `+220`-aware — the outcome's `target`). */
  to: string;
}

export interface ContactConversionPlan {
  contactId: string;
  contactName: string;
  /**
   * One entry per phone row the user selected — NOT de-duped. The writer
   * matches these against the contact's live rows by value, consuming one per
   * row, so selecting one of two identical numbers converts exactly one.
   */
  conversions: NumberConversion[];
}

/** Group the selected phone keys by contact, dropping contacts with none. */
export function groupSelectionByContact(
  analysis: ContactAnalysis,
  selected: Set<string>,
): Map<string, AnalyzedContact> {
  const byId = new Map<string, AnalyzedContact>();
  for (const analyzed of analysis.actionable) {
    const hasSelection = analyzed.numbers.some((n) => n.convertible && selected.has(n.key));
    if (hasSelection) {
      byId.set(analyzed.contact.id, analyzed);
    }
  }
  return byId;
}

/** One `{ from, to }` per selected, convertible phone row on this contact. */
export function planContactConversions(
  analyzed: AnalyzedContact,
  selected: Set<string>,
  mode: ConversionMode = 'replace',
): NumberConversion[] {
  const conversions: NumberConversion[] = [];
  const seen = new Set<string>();
  for (const number of analyzed.numbers) {
    if (
      !selected.has(number.key) ||
      number.outcome.status !== 'convertible' ||
      number.outcome.target === number.phone.original
    ) {
      continue;
    }
    if (mode === 'add') {
      // The new number is already on this contact — nothing to add.
      if (number.alreadyPaired) {
        continue;
      }
      // A duplicate old row would only add a duplicate new row.
      const key = norm(number.phone.original);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
    }
    conversions.push({ from: number.phone.original, to: number.outcome.target });
  }
  return conversions;
}

/**
 * Plan an entire run. Order follows `analysis.actionable`.
 * `onlyContactIds`, when given, restricts the run to those contacts (used to
 * retry the ones that failed).
 */
export function planConversions(
  analysis: ContactAnalysis,
  selected: Set<string>,
  mode: ConversionMode = 'replace',
  onlyContactIds?: Set<string>,
): ContactConversionPlan[] {
  const grouped = groupSelectionByContact(analysis, selected);
  const plans: ContactConversionPlan[] = [];
  for (const analyzed of grouped.values()) {
    if (onlyContactIds && !onlyContactIds.has(analyzed.contact.id)) {
      continue;
    }
    const conversions = planContactConversions(analyzed, selected, mode);
    if (conversions.length > 0) {
      plans.push({
        contactId: analyzed.contact.id,
        contactName: analyzed.contact.name,
        conversions,
      });
    }
  }
  return plans;
}

/** `planConversions` in `replace` mode — kept for existing callers. */
export function planMigration(
  analysis: ContactAnalysis,
  selected: Set<string>,
  onlyContactIds?: Set<string>,
): ContactConversionPlan[] {
  return planConversions(analysis, selected, 'replace', onlyContactIds);
}

export function makeBatchId(now: Date = new Date()): string {
  return `mig_${now.toISOString().replace(/[:.]/g, '-')}`;
}
