/** Short, human-readable labels for non-convertible numbering outcomes. */
import type { ConversionOutcome, InvalidReason, NotApplicableReason } from '@/types';

const NOT_APPLICABLE: Record<NotApplicableReason, string> = {
  'non-gambian': 'Not a Gambian number',
  'fixed-line': 'Landline — not changing',
  'operator-not-migrating': 'This network is not changing yet',
  'unknown-range': 'Number not recognised — left as is',
  'short-code': 'Short code',
};

const INVALID: Record<InvalidReason, string> = {
  empty: 'No number',
  'too-short': 'Too short to be a phone number',
  'too-long': 'Not a valid number',
  'non-dialable': 'Not a plain phone number',
};

/** A one-line explanation of why a number is or is not being changed. */
export function outcomeLabel(outcome: ConversionOutcome): string {
  switch (outcome.status) {
    case 'convertible':
      return `${outcome.operatorName} → new format`;
    case 'already-migrated':
      return 'Already in the new 9-digit format';
    case 'not-applicable':
      return NOT_APPLICABLE[outcome.reason];
    case 'invalid':
      return INVALID[outcome.reason];
  }
}
