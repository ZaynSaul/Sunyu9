/**
 * Step 1 of the numbering pipeline: turn whatever is stored on the device into a
 * predictable shape.
 *
 * Handles the formats people actually save:
 *   7123456                              plain national
 *   712 3456 / 712-34-56 / (712) 3456    punctuation
 *   +220 7123456 / 00220 7123456 / 2207123456   country code
 *   +220 (0) 7123456                     country code + trunk zero
 *   87 712 3456                          already-migrated national
 *
 * The Gambia has no national trunk prefix, so a lone leading `0` is only stripped
 * when doing so lands on a valid national length. Country code `220` is only
 * stripped when the remainder is a valid national length — this protects real
 * national numbers that happen to begin with `220`.
 */
import { MIGRATION } from '@/constants/numbering';
import type { NormalizedNumber } from '@/types';

const { countryCallingCode, oldNationalLength, newNationalLength } = MIGRATION;

function isNationalLength(len: number): boolean {
  return len === oldNationalLength || len === newNationalLength;
}

/** Characters that mean "this is not a plain dialable number". */
const NON_DIALABLE = /[a-wyz]|ext|#|\*|,|;/i;

/** Strip a leading `0` when the remainder is a valid national length. */
function stripTrunkZero(digits: string): string {
  return digits.startsWith('0') && isNationalLength(digits.length - 1) ? digits.slice(1) : digits;
}

/**
 * @param explicitInternational the raw string carried a leading `+`, so the
 *   caller has told us "this is already in international form". When that is set
 *   and the digits start with `220`, `220` is unambiguously the country code —
 *   we strip it even if what follows is the wrong length, so a malformed number
 *   like `+220 7890` fails validation instead of being re-read as the national
 *   number `2207890`.
 */
function stripCountryCode(
  digits: string,
  explicitInternational: boolean,
): { nsn: string; hadCountryCode: boolean } {
  // 00 220 …  — the `00` prefix is itself an explicit international marker.
  if (digits.startsWith('00' + countryCallingCode)) {
    return { nsn: stripTrunkZero(digits.slice(2 + countryCallingCode.length)), hadCountryCode: true };
  }

  // 220 …  — a country code if a plausible national number follows, or if the
  // caller marked the number international.
  if (digits.startsWith(countryCallingCode)) {
    const remainder = digits.slice(countryCallingCode.length);
    const withoutTrunk = stripTrunkZero(remainder);
    if (
      explicitInternational ||
      isNationalLength(remainder.length) ||
      isNationalLength(withoutTrunk.length)
    ) {
      return { nsn: withoutTrunk, hadCountryCode: true };
    }
  }

  return { nsn: stripTrunkZero(digits), hadCountryCode: false };
}

export function normalizeNumber(raw: string): NormalizedNumber {
  const trimmed = (raw ?? '').trim();
  const hasNonDialable = NON_DIALABLE.test(trimmed);
  const digits = trimmed.replace(/\D+/g, '');

  if (digits.length === 0) {
    return { raw, digits: '', hadCountryCode: false, hasNonDialable, nsn: null };
  }

  const hadPlus = trimmed.startsWith('+');
  const hadZeroZero = /^0{2}[1-9]/.test(digits);
  const { nsn, hadCountryCode: strippedCountryCode } = stripCountryCode(digits, hadPlus);

  return {
    raw,
    digits,
    hadCountryCode: strippedCountryCode || hadPlus || hadZeroZero,
    hasNonDialable,
    nsn: nsn.length > 0 ? nsn : null,
  };
}
