/**
 * Step 2 of the numbering pipeline: decide what a normalized number *is*.
 *
 * This module answers "is this a Gambian national number, and of which era?" It
 * does not know about operators or conversion — that is `numberingRules`.
 */
import { MIGRATION } from '@/constants/numbering';
import type { NationalNumberKind, NormalizedNumber } from '@/types';

const { oldNationalLength, newNationalLength } = MIGRATION;

export interface ValidationResult {
  /** The number could be a Gambian national number of a recognised length. */
  isGambianNational: boolean;
  kind: NationalNumberKind;
  /** Present only when `kind` is `old-national` or `new-national`. */
  nsn: string | null;
}

export function validateNumber(normalized: NormalizedNumber): ValidationResult {
  const { nsn } = normalized;

  if (!nsn || !/^\d+$/.test(nsn)) {
    return { isGambianNational: false, kind: 'unknown', nsn: null };
  }

  if (nsn.length === oldNationalLength) {
    return { isGambianNational: true, kind: 'old-national', nsn };
  }
  if (nsn.length === newNationalLength) {
    return { isGambianNational: true, kind: 'new-national', nsn };
  }

  return { isGambianNational: false, kind: 'unknown', nsn: null };
}

/** Convenience: a 9-digit national is "well formed" for a given 2-digit prefix set. */
export function isNewNationalLength(value: string): boolean {
  return /^\d+$/.test(value) && value.length === newNationalLength;
}

export function isOldNationalLength(value: string): boolean {
  return /^\d+$/.test(value) && value.length === oldNationalLength;
}
