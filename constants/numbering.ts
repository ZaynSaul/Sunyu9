/**
 * The Gambian 7-to-9-digit mobile numbering plan — reference data only.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT IS HAPPENING  (confirmed — every source agrees)
 * PURA (Public Utilities Regulatory Authority) is expanding national mobile
 * numbers from 7 to 9 digits. The existing 7-digit number is kept intact and a
 * 2-digit operator prefix is prepended:
 *
 *   Africell  ->  87 + <existing 7 digits>
 *   QCell     ->  83 + <existing 7 digits>
 *   Comium    ->  86 + <existing 7 digits>
 *   Gamcel & Gamtel  ->  NOT migrating in this phase ("not ready yet" — DG Njogou Bah)
 *
 * TIMELINE
 *   2026-09-04  both 7- and 9-digit numbers route (dual-run begins)
 *   2026-11-30  last day 7-digit numbers connect; 9-digit only afterwards
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LEADING-DIGIT MAP  (PURA's numbering-resource-management page, updated for the
 * reallocations PURA confirmed for this migration)
 *
 *   Africell   2xxxxxx , 4xxxxxx , 7xxxxxx   -> migrates (87)
 *   QCell      3xxxxxx , 5xxxxxx             -> migrates (83)
 *   Comium     6xxxxxx                        -> migrates (86)
 *   Gamcel     9xxxxxx                        -> not migrating this phase
 *   Gamtel     8xxxxxx (fixed / CDMA / VoIP)  -> not a mobile migration
 *
 * The PURA notice's own worked example — "7xx xxxx" -> "87 7xx xxxx" — confirms
 * Africell owns the 7 range. PURA's page shows 4xxxxxx and 5xxxxxx historically
 * under Gamtel; both have been reallocated — 4xxxxxx to Africell, 5xxxxxx to
 * QCell — and migrate accordingly. Gamtel keeps only 8xxxxxx.
 *
 * The app's policy stays CONSERVATIVE: convert only what maps cleanly to a
 * migrating operator; the engine re-validates every result; everything else is
 * left untouched and shown to the user anyway.
 *
 * SOURCES (last checked 2026-08-28):
 *  - PURA — Numbering Resource Management (allocation table): https://pura.gm/ict/scarce-resource-management/numbering-resource-management/
 *  - PURA — Public notice, 7-to-9-digit migration: https://pura.gm/public-notice-migration-of-the-national-mobile-numbering-plan-from-7-digit-to-9-digit-format/
 *  - The Point:  https://thepoint.gm/africa/gambia/headlines/gambia-set-to-move-phone-numbers-from-7-to-nine-digit-system
 *  - The Standard: https://standard.gm/gambias-telephone-numbers-to-be-increased-to-nine-digits/
 *  - Wikipedia:  https://en.wikipedia.org/wiki/Telephone_numbers_in_the_Gambia
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * This module is DATA ONLY. The normalise -> validate -> classify -> convert
 * pipeline that consumes it lives in `services/numbering/`.
 */

export const NUMBERING_LAST_VERIFIED = '2026-08-28';

/** Machine-readable state of how trustworthy this table is. Surface in Settings. */
export const NUMBERING_VERIFICATION = {
  /** Every operator range is confirmed against PURA's allocation table. */
  status: 'confirmed' as 'official-partial' | 'confirmed',
  confirmed: [
    'Operator prefixes: Africell 87, QCell 83, Comium 86',
    'New number = 2-digit prefix + existing 7 digits (9 total)',
    'Africell owns 2xxxxxx, 4xxxxxx and 7xxxxxx; QCell 3xxxxxx and 5xxxxxx; Comium 6xxxxxx',
    'Gamcel (9xxxxxx) and Gamtel fixed lines (8xxxxxx) are excluded',
    'Dual-run 2026-09-04 → 2026-11-30',
  ],
  needsOfficialConfirmation: [] as string[],
  blocker: null as string | null,
} as const;

export const MIGRATION = {
  /** Country calling code for The Gambia (E.164), no `+`. */
  countryCallingCode: '220',
  /** Significant-digit length of an old national number. */
  oldNationalLength: 7,
  /** Significant-digit length of a new national number. */
  newNationalLength: 9,
  /** First day the new 9-digit numbers route (both formats work). */
  dualRunStart: '2026-09-04',
  /** Last day old 7-digit numbers connect. */
  sevenDigitCutoff: '2026-11-30',
} as const;

export const NUMBERING_SOURCES: readonly { label: string; url: string }[] = [
  {
    label: 'PURA — Numbering Resource Management (allocation table)',
    url: 'https://pura.gm/ict/scarce-resource-management/numbering-resource-management/',
  },
  {
    label: 'PURA — Public notice: migration to 9-digit format',
    url: 'https://pura.gm/public-notice-migration-of-the-national-mobile-numbering-plan-from-7-digit-to-9-digit-format/',
  },
  {
    label: 'The Point — Gambia set to move phone numbers from 7 to nine-digit system',
    url: 'https://thepoint.gm/africa/gambia/headlines/gambia-set-to-move-phone-numbers-from-7-to-nine-digit-system',
  },
  {
    label: 'Wikipedia — Telephone numbers in the Gambia',
    url: 'https://en.wikipedia.org/wiki/Telephone_numbers_in_the_Gambia',
  },
];

export type OperatorId = 'africell' | 'qcell' | 'comium' | 'gamcel' | 'gamtel-fixed';

/** How sure we are that a rule's leading-digit match is correct. */
export type RuleConfidence =
  /** Every reachable source agrees. */
  | 'high'
  /** Sources mostly agree but not the official document. */
  | 'medium'
  /** Verified against PURA's official allocation table. */
  | 'confirmed';

export interface OperatorRule {
  id: OperatorId;
  /** Human-readable operator / line name. */
  name: string;
  /**
   * The 2-digit prefix prepended to the existing 7-digit number during
   * migration, or `null` when this operator/line is not part of this phase.
   */
  newPrefix: string | null;
  /** Whether numbers on this operator are converted by the app. */
  migrating: boolean;
  confidence: RuleConfidence;
  /**
   * Does a 7-significant-digit national number belong to this operator/line?
   * `digits` is exactly 7 characters, all `0-9`.
   */
  matches: (digits: string) => boolean;
  /** Short explanation shown in Settings / used in code review. */
  note: string;
}

export const OPERATOR_RULES: readonly OperatorRule[] = [
  {
    id: 'africell',
    name: 'Africell',
    newPrefix: '87',
    migrating: true,
    confidence: 'confirmed', // PURA allocation table + the notice's "7xx xxxx → 87 7xx xxxx" example
    matches: (d) => d.length === 7 && (d[0] === '2' || d[0] === '4' || d[0] === '7'),
    note: 'Africell owns the 2xxxxxx, 4xxxxxx and 7xxxxxx ranges (4xxxxxx reallocated from Gamtel).',
  },
  {
    id: 'qcell',
    name: 'QCell',
    newPrefix: '83',
    migrating: true,
    confidence: 'confirmed', // 3xxxxxx and 5xxxxxx per PURA (5 reallocated from Gamtel to QCell)
    matches: (d) => d.length === 7 && (d[0] === '3' || d[0] === '5'),
    note: 'QCell owns the 3xxxxxx and 5xxxxxx ranges.',
  },
  {
    id: 'comium',
    name: 'Comium',
    newPrefix: '86',
    migrating: true,
    confidence: 'confirmed',
    matches: (d) => d.length === 7 && d[0] === '6',
    note: 'Comium owns the 6xxxxxx range.',
  },
  {
    id: 'gamcel',
    name: 'Gamcel',
    newPrefix: null,
    migrating: false,
    confidence: 'confirmed',
    matches: (d) => d.length === 7 && d[0] === '9',
    note: 'Gamcel (9xxxxxx) is not part of this migration phase — do not modify.',
  },
  {
    id: 'gamtel-fixed',
    name: 'Gamtel (fixed line)',
    newPrefix: null,
    migrating: false,
    confidence: 'confirmed',
    matches: (d) => d.length === 7 && d[0] === '8',
    note: 'Gamtel fixed / CDMA / VoIP lines (8xxxxxx) are not mobile numbers — do not modify.',
  },
];
