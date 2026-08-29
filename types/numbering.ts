/**
 * Result types for the numbering engine.
 *
 * The pipeline is: normalize -> validate -> classify -> convert -> re-validate.
 * Every phone number a contact holds is run through it independently and lands
 * in exactly one of the outcomes below.
 */
import type { OperatorId } from '@/constants/numbering';

export type NationalNumberKind =
  /** 7 significant digits — the old plan. */
  | 'old-national'
  /** 9 significant digits — the new plan. */
  | 'new-national'
  /** Right shape for neither. */
  | 'unknown';

/** Output of `normalizeNumber`. */
export interface NormalizedNumber {
  /** The input, untouched. */
  raw: string;
  /** Every digit of the input, in order, with no `+`, spaces or punctuation. */
  digits: string;
  /**
   * The input was written in international form — a leading `+` or `00`, or a
   * bare `220…` country code we were able to strip.
   */
  hadCountryCode: boolean;
  /** Contained characters that cannot be part of a normal dialable number */
  /** (letters, `*`, `#`, `x`/`ext`, pauses). */
  hasNonDialable: boolean;
  /**
   * National significant number (country code and trunk `0` removed), digits
   * only — or `null` when the input is empty or clearly not a phone number.
   */
  nsn: string | null;
}

export type NotApplicableReason =
  /** Not a Gambian number at all. */
  | 'non-gambian'
  /** Gamtel fixed line (starts 4 or 8). */
  | 'fixed-line'
  /** Gamcel — a real Gambian mobile, but not part of this migration phase. */
  | 'operator-not-migrating'
  /** 7 digits, Gambian-shaped, but no operator range claims it — skipped on purpose. */
  | 'unknown-range'
  /** USSD / short code / emergency number. */
  | 'short-code';

export type InvalidReason =
  | 'empty'
  | 'too-short'
  | 'too-long'
  | 'non-dialable';

export type ConversionOutcome =
  | {
      status: 'convertible';
      operator: OperatorId;
      operatorName: string;
      /** 7 digits. */
      oldNational: string;
      /** 9 digits. */
      newNational: string;
      /** `+220` + newNational. The safe format to write back to a contact. */
      e164: string;
      /**
       * How to show the migrated number in the preview — one unbroken run of
       * digits (`877123456`), with the `+220 ` prefix kept only when the stored
       * number had a country code.
       */
      display: string;
      /** The stored number was written in international (`+220`) form. */
      hadCountryCode: boolean;
      /**
       * What should actually be written back to the contact: `e164` when the
       * original used international form, otherwise the bare 9-digit national.
       */
      target: string;
    }
  | {
      status: 'already-migrated';
      operator: OperatorId | null;
      newNational: string;
      e164: string;
    }
  | { status: 'not-applicable'; reason: NotApplicableReason; kind: NationalNumberKind }
  | { status: 'invalid'; reason: InvalidReason };
