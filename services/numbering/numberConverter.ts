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
 * Display form of the migrated national number: `XX XXX XXXX` — the operator's
 * 2-digit code, then the untouched 7-digit number grouped 3-4. This mirrors
 * PURA's own worked example (`7xx xxxx` → `87 7xx xxxx`). Anything that isn't a
 * clean 9-digit string is returned unchanged.
 */
export function formatNewNational(nineDigits: string): string {
  if (!/^\d{9}$/.test(nineDigits)) {
    return nineDigits;
  }
  return `${nineDigits.slice(0, 2)} ${nineDigits.slice(2, 5)} ${nineDigits.slice(5)}`;
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
  // The single form shown in the preview *and* written to the contact — they
  // must agree (the confirmation sheet is a promise of exactly what gets saved).
  //   • had a country code  ->  `+220 87 701 2345`  (both OSes format E.164 well)
  //   • bare local number   ->  `877012345`         (plain 9 digits — iOS strips
  //     any spacing it can't format for a national number it has no rule for,
  //     so grouping the stored value would only mislead)
  const written = normalized.hadCountryCode
    ? `+${countryCallingCode} ${formatNewNational(newNational)}`
    : newNational;

  return {
    status: 'convertible',
    operator: rule.id,
    operatorName: rule.name,
    oldNational: nsn,
    newNational,
    e164,
    display: written,
    hadCountryCode: normalized.hadCountryCode,
    target: written,
  };
}
