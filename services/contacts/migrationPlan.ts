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
  /** Non-empty — a contact with nothing selected is dropped. Matched by value. */
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

/** The `{ from, to }` conversions the user selected for one contact, de-duped. */
export function planContactConversions(
  analyzed: AnalyzedContact,
  selected: Set<string>,
): NumberConversion[] {
  const conversions: NumberConversion[] = [];
  for (const number of analyzed.numbers) {
    if (
      !selected.has(number.key) ||
      number.outcome.status !== 'convertible' ||
      number.outcome.target === number.phone.original
    ) {
      continue;
    }
    const from = number.phone.original;
    if (!conversions.some((c) => c.from === from)) {
      conversions.push({ from, to: number.outcome.target });
    }
  }
  return conversions;
}

/**
 * Plan an entire run. Order follows `analysis.actionable`.
 * `onlyContactIds`, when given, restricts the run to those contacts (used to
 * retry the ones that failed).
 */
export function planMigration(
  analysis: ContactAnalysis,
  selected: Set<string>,
  onlyContactIds?: Set<string>,
): ContactConversionPlan[] {
  const grouped = groupSelectionByContact(analysis, selected);
  const plans: ContactConversionPlan[] = [];
  for (const analyzed of grouped.values()) {
    if (onlyContactIds && !onlyContactIds.has(analyzed.contact.id)) {
      continue;
    }
    const conversions = planContactConversions(analyzed, selected);
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

export function makeBatchId(now: Date = new Date()): string {
  return `mig_${now.toISOString().replace(/[:.]/g, '-')}`;
}
