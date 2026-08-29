/**
 * Step 4 — the orchestrator. Given a raw phone string as stored on a device,
 * return exactly one `ConversionOutcome`.
 *
 *   normalize -> validate -> classify -> convert -> re-validate result
 *
 * Design bias: **conservative**. Anything we are not sure about lands in
 * `not-applicable` or `invalid`, never in `convertible`. See the note in
 * `constants/numbering.ts`.
 */
import { MIGRATION } from '@/constants/numbering';
import type { ConversionOutcome } from '@/types';
import { normalizeNumber } from './numberNormalizer';
import {
  applyConversion,
  classifyNewNational,
  classifyOldNational,
} from './numberingRules';
import { validateNumber } from './numberValidator';

const { countryCallingCode } = MIGRATION;

/**
 * Display form of the migrated number.
 *
 * It is shown as one unbroken run of 9 digits: the operator's 2-digit code sits
 * directly in front of the untouched 7-digit number, with no separator. The
 * prefix and the old number are now a single number, not "code + number", so we
 * never put a space between them.
 */
export function formatNewNational(nineDigits: string): string {
  return nineDigits;
}

export function toE164(nationalNumber: string): string {
  return `+${countryCallingCode}${nationalNumber}`;
}

export function convertNumber(raw: string): ConversionOutcome {
  const normalized = normalizeNumber(raw);

  if (normalized.digits.length === 0) {
    return { status: 'invalid', reason: normalized.hasNonDialable ? 'non-dialable' : 'empty' };
  }
  if (normalized.hasNonDialable) {
    return { status: 'invalid', reason: 'non-dialable' };
  }
  if (!normalized.nsn) {
    return { status: 'invalid', reason: 'too-short' };
  }

  const validation = validateNumber(normalized);

  // Not a Gambian national number of a known length.
  if (!validation.isGambianNational || !validation.nsn) {
    const len = normalized.nsn.length;
    if (normalized.hadCountryCode) {
      // Had a country code but the rest isn't a valid national number. If the
      // code was +220 it's a malformed Gambian number; otherwise it's foreign.
      const wasGambianCode =
        normalized.digits.startsWith(countryCallingCode) ||
        normalized.digits.startsWith('00' + countryCallingCode);
      return {
        status: 'not-applicable',
        reason: wasGambianCode ? 'unknown-range' : 'non-gambian',
        kind: 'unknown',
      };
    }
    if (len < 3) {
      return { status: 'invalid', reason: 'too-short' };
    }
    if (len <= 6) {
      return { status: 'not-applicable', reason: 'short-code', kind: 'unknown' };
    }
    // 7-ish or longer, no country code, wrong length for either plan.
    return { status: 'not-applicable', reason: 'unknown-range', kind: 'unknown' };
  }

  const nsn = validation.nsn;

  // A 9-digit national number.
  if (validation.kind === 'new-national') {
    const rule = classifyNewNational(nsn);
    if (!rule) {
      // Right length, but not a recognised new number — do not touch it.
      return { status: 'not-applicable', reason: 'unknown-range', kind: 'new-national' };
    }
    return {
      status: 'already-migrated',
      operator: rule.id,
      newNational: nsn,
      e164: toE164(nsn),
    };
  }

  // Old 7-digit plan — the case this app exists for.
  const rule = classifyOldNational(nsn);
  if (!rule) {
    return { status: 'not-applicable', reason: 'unknown-range', kind: 'old-national' };
  }
  if (!rule.migrating) {
    return {
      status: 'not-applicable',
      reason: rule.id === 'gamtel-fixed' ? 'fixed-line' : 'operator-not-migrating',
      kind: 'old-national',
    };
  }

  const newNational = applyConversion(rule, nsn);
  // Re-validate: the result must be a well-formed new national for this operator.
  if (!newNational || classifyNewNational(newNational)?.id !== rule.id) {
    return { status: 'not-applicable', reason: 'unknown-range', kind: 'old-national' };
  }

  const e164 = toE164(newNational);
  return {
    status: 'convertible',
    operator: rule.id,
    operatorName: rule.name,
    oldNational: nsn,
    newNational,
    e164,
    // Mirror how the number was stored: keep the `+220` in front when the
    // original had a country code, so the preview matches what gets written.
    display: normalized.hadCountryCode
      ? `+${countryCallingCode} ${formatNewNational(newNational)}`
      : formatNewNational(newNational),
    hadCountryCode: normalized.hadCountryCode,
    target: normalized.hadCountryCode ? e164 : newNational,
  };
}
