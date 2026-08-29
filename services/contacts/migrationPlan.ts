/**
 * Pure planning for a migration run — no native calls.
 *
 * `expo-contacts`' `patch({ phones })` **replaces the whole phone list**, so for
 * every contact we touch we must rebuild the complete list: unchanged rows kept
 * exactly as they were, selected rows swapped to their converted `target`.
 */
import type {
  AnalyzedContact,
  ContactAnalysis,
} from '@/services/contacts/contactAnalyzer';
import { phoneKey } from '@/services/contacts/contactAnalyzer';
import type { ContactBackup, PatchPhone } from '@/types';

/** Group the selected phone keys by contact id, dropping contacts with none. */
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

export interface ContactPatchPlan {
  contactId: string;
  contactName: string;
  /** The full phone list to write. */
  nextPhones: PatchPhone[];
  /** The full phone list as it is now — the backup. */
  backup: ContactBackup;
  /** Count of rows actually changing. */
  changedCount: number;
}

/**
 * Build the patch + backup for one contact given the user's selection.
 * Returns `null` when nothing would actually change.
 */
export function planContactPatch(
  analyzed: AnalyzedContact,
  selected: Set<string>,
): ContactPatchPlan | null {
  const { contact, numbers } = analyzed;

  const originalPhones: PatchPhone[] = contact.phoneNumbers.map((phone) => ({
    ...(phone.id ? { id: phone.id } : {}),
    label: phone.label,
    number: phone.original,
  }));

  const changedTags: string[] = [];
  const nextPhones: PatchPhone[] = contact.phoneNumbers.map((phone, index) => {
    const key = phoneKey(contact.id, phone, index);
    const analyzedNumber = numbers.find((n) => n.key === key);
    const base: PatchPhone = {
      ...(phone.id ? { id: phone.id } : {}),
      label: phone.label,
      number: phone.original,
    };

    if (
      selected.has(key) &&
      analyzedNumber?.outcome.status === 'convertible' &&
      analyzedNumber.outcome.target !== phone.original
    ) {
      changedTags.push(phone.id ?? `i${index}`);
      return { ...base, number: analyzedNumber.outcome.target };
    }
    return base;
  });

  if (changedTags.length === 0) {
    return null;
  }

  return {
    contactId: contact.id,
    contactName: contact.name,
    nextPhones,
    backup: {
      contactId: contact.id,
      contactName: contact.name,
      originalPhones,
      newPhones: nextPhones,
      changedPhoneTags: changedTags,
    },
    changedCount: changedTags.length,
  };
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
): ContactPatchPlan[] {
  const grouped = groupSelectionByContact(analysis, selected);
  const plans: ContactPatchPlan[] = [];
  for (const analyzed of grouped.values()) {
    if (onlyContactIds && !onlyContactIds.has(analyzed.contact.id)) {
      continue;
    }
    const plan = planContactPatch(analyzed, selected);
    if (plan) {
      plans.push(plan);
    }
  }
  return plans;
}

export function makeBatchId(now: Date = new Date()): string {
  return `mig_${now.toISOString().replace(/[:.]/g, '-')}`;
}
