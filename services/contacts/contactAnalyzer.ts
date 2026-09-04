/**
 * Runs every phone number of every contact through the numbering engine and
 * groups the results for the preview screen.
 *
 * Pure except for the optional cooperative yielding in `analyzeContacts` (which
 * keeps the UI responsive while checking thousands of numbers). The per-contact
 * function `analyzeContact` is fully synchronous and unit-tested.
 */
import { convertNumber, normalizeNumber } from '@/services/numbering';
import type { AppContact, AppPhoneNumber, ConversionOutcome, ProgressCallback } from '@/types';

/** Stable identity for a single phone entry across screens and selection state. */
export function phoneKey(contactId: string, phone: AppPhoneNumber, index: number): string {
  return `${contactId}::${phone.id ?? `i${index}`}`;
}

export interface AnalyzedPhoneNumber {
  key: string;
  phone: AppPhoneNumber;
  outcome: ConversionOutcome;
  /** `outcome.status === 'convertible'`. */
  convertible: boolean;
  /**
   * This is a convertible old number **and** another row on the same contact
   * already holds its 9-digit twin — so the "add the new number" pass has
   * nothing to do here, and the "remove old numbers" pass can drop this row.
   */
  alreadyPaired: boolean;
}

export interface AnalyzedContact {
  contact: AppContact;
  numbers: AnalyzedPhoneNumber[];
  /** How many of this contact's numbers can be converted. */
  convertibleCount: number;
}

export interface AnalysisSummary {
  contactsScanned: number;
  numbersScanned: number;
  /** Contacts with at least one convertible number. */
  actionableContacts: number;
  convertibleNumbers: number;
  alreadyMigrated: number;
  notApplicable: number;
  invalid: number;
}

export interface ContactAnalysis {
  all: AnalyzedContact[];
  /** Contacts with at least one convertible number — what the preview shows. */
  actionable: AnalyzedContact[];
  summary: AnalysisSummary;
}

/**
 * The bare 9-digit national number this row represents, if any — so a
 * convertible old number can tell whether its migrated twin is already saved
 * on the same contact. `already-migrated` rows expose it directly; anything
 * else is normalized (`+220 87 712 3456` → `877123456`).
 */
function nineDigitKey(analyzed: AnalyzedPhoneNumber): string | null {
  if (analyzed.outcome.status === 'already-migrated') {
    return analyzed.outcome.newNational;
  }
  if (analyzed.outcome.status === 'convertible') {
    return null; // this row *is* the old number, not the twin
  }
  const nsn = normalizeNumber(analyzed.phone.original).nsn;
  return nsn && nsn.length === 9 ? nsn : null;
}

export function analyzeContact(contact: AppContact): AnalyzedContact {
  const numbers: AnalyzedPhoneNumber[] = contact.phoneNumbers.map((phone, index) => {
    const outcome = convertNumber(phone.original);
    return {
      key: phoneKey(contact.id, phone, index),
      phone,
      outcome,
      convertible: outcome.status === 'convertible',
      alreadyPaired: false,
    };
  });

  for (const number of numbers) {
    if (number.outcome.status !== 'convertible') {
      continue;
    }
    const twin = number.outcome.newNational;
    number.alreadyPaired = numbers.some((other) => other !== number && nineDigitKey(other) === twin);
  }

  return {
    contact,
    numbers,
    convertibleCount: numbers.filter((n) => n.convertible).length,
  };
}

function emptySummary(): AnalysisSummary {
  return {
    contactsScanned: 0,
    numbersScanned: 0,
    actionableContacts: 0,
    convertibleNumbers: 0,
    alreadyMigrated: 0,
    notApplicable: 0,
    invalid: 0,
  };
}

function tally(summary: AnalysisSummary, analyzed: AnalyzedContact): void {
  summary.contactsScanned += 1;
  summary.numbersScanned += analyzed.numbers.length;
  if (analyzed.convertibleCount > 0) {
    summary.actionableContacts += 1;
  }
  for (const { outcome } of analyzed.numbers) {
    switch (outcome.status) {
      case 'convertible':
        summary.convertibleNumbers += 1;
        break;
      case 'already-migrated':
        summary.alreadyMigrated += 1;
        break;
      case 'not-applicable':
        summary.notApplicable += 1;
        break;
      case 'invalid':
        summary.invalid += 1;
        break;
    }
  }
}

const yieldToUi = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

export interface AnalyzeOptions {
  onProgress?: ProgressCallback;
  /** Contacts to process between UI yields. */
  chunkSize?: number;
}

/**
 * Analyze a list of contacts, yielding to the UI thread periodically so a
 * progress indicator can paint. Order of `all` matches the input order.
 */
export async function analyzeContacts(
  contacts: AppContact[],
  options: AnalyzeOptions = {},
): Promise<ContactAnalysis> {
  const { onProgress, chunkSize = 100 } = options;
  const total = contacts.length;
  const all: AnalyzedContact[] = [];
  const summary = emptySummary();

  onProgress?.(0, total);

  for (let i = 0; i < total; i++) {
    const analyzed = analyzeContact(contacts[i]);
    all.push(analyzed);
    tally(summary, analyzed);

    if ((i + 1) % chunkSize === 0) {
      onProgress?.(i + 1, total);
      await yieldToUi();
    }
  }

  onProgress?.(total, total);

  return {
    all,
    actionable: all.filter((c) => c.convertibleCount > 0),
    summary,
  };
}
