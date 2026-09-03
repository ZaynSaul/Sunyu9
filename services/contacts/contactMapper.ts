/**
 * Pure mapping from raw `expo-contacts` shapes to the app's `AppContact` model.
 *
 * This file imports only *types* from `expo-contacts` (erased at build time), so
 * it can be unit-tested without the native module. All runtime access to the
 * contacts API lives in `contactReader.ts`.
 */
import type { ExistingPhone } from 'expo-contacts';

import type { AppContact, AppPhoneNumber } from '@/types';
import { friendlyPhoneLabel } from '@/utils/phoneLabel';

/** The subset of contact fields this app reads. Structurally matches the */
/** object returned by `Contact.getAllDetails([...])`. */
export interface RawContactInput {
  id: string;
  fullName?: string | null;
  givenName?: string | null;
  familyName?: string | null;
  company?: string | null;
  phones?: ExistingPhone[];
}

/** Reduce a raw phone entry to the app model, or `null` if it has no number. */
export function mapPhoneNumber(raw: ExistingPhone): AppPhoneNumber | null {
  const original = (raw.number ?? '').trim();
  if (original.length === 0) {
    return null;
  }
  return {
    id: raw.id ?? null,
    label: friendlyPhoneLabel(raw.label),
    original,
    digits: original.replace(/\D+/g, ''),
  };
}

function displayName(raw: RawContactInput, phoneNumbers: AppPhoneNumber[]): string {
  const parts = [raw.givenName, raw.familyName].filter(
    (p): p is string => typeof p === 'string' && p.trim().length > 0,
  );
  return (
    raw.fullName?.trim() ||
    parts.join(' ').trim() ||
    raw.company?.trim() ||
    phoneNumbers[0]?.original ||
    'Unnamed contact'
  );
}

/**
 * Map a raw contact to `AppContact`, or `null` when it has no usable phone
 * number (such contacts are irrelevant to this app).
 */
export function mapContact(raw: RawContactInput): AppContact | null {
  const phoneNumbers = (raw.phones ?? [])
    .map(mapPhoneNumber)
    .filter((p): p is AppPhoneNumber => p !== null);

  if (phoneNumbers.length === 0) {
    return null;
  }

  return {
    id: raw.id,
    name: displayName(raw, phoneNumbers),
    givenName: raw.givenName ?? null,
    familyName: raw.familyName ?? null,
    phoneNumbers,
  };
}
