/**
 * Step 3 of the numbering pipeline: apply the official operator rules.
 *
 * Everything operator-specific lives in `constants/numbering.ts` as data. This
 * module just runs a national number against that table.
 */
import { MIGRATION, OPERATOR_RULES, type OperatorId, type OperatorRule } from '@/constants/numbering';

export interface OperatorMatch {
  rule: OperatorRule;
}

/** Which operator owns this 7-digit old national number, if any. */
export function classifyOldNational(sevenDigits: string): OperatorRule | null {
  return OPERATOR_RULES.find((rule) => rule.matches(sevenDigits)) ?? null;
}

/**
 * Which operator a 9-digit new national number belongs to. Requires the 2-digit
 * prefix to be a known migrating prefix *and* the trailing 7 digits to fall in
 * that same operator's old range — otherwise it is not a well-formed new number.
 */
export function classifyNewNational(nineDigits: string): OperatorRule | null {
  if (nineDigits.length !== MIGRATION.newNationalLength) {
    return null;
  }
  const prefix = nineDigits.slice(0, 2);
  const body = nineDigits.slice(2);
  return (
    OPERATOR_RULES.find(
      (rule) => rule.migrating && rule.newPrefix === prefix && rule.matches(body),
    ) ?? null
  );
}

/** Build the 9-digit number for a convertible old national. */
export function applyConversion(rule: OperatorRule, sevenDigits: string): string | null {
  if (!rule.migrating || !rule.newPrefix) {
    return null;
  }
  return `${rule.newPrefix}${sevenDigits}`;
}

export function operatorName(id: OperatorId): string {
  return OPERATOR_RULES.find((rule) => rule.id === id)?.name ?? id;
}
