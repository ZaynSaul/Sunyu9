/**
 * Reads the device address book and maps it to the app's `AppContact` model.
 *
 * Uses the SDK 57 `expo-contacts` class API:
 *  - `getPermissionsAsync` / `requestPermissionsAsync` for access
 *  - `Contact.getCount()` for the progress denominator
 *  - `Contact.getAllDetails(fields, { limit, offset })` for paged bulk reads
 *
 * Mapping is delegated to the pure, testable `contactMapper` module. This module
 * only reads and shapes data — it never writes and never makes a network call.
 */
import {
  Contact,
  ContactField,
  getPermissionsAsync,
  PermissionStatus,
  requestPermissionsAsync,
  type ContactsPermissionResponse,
} from 'expo-contacts';

import type { AppContact, PermissionSnapshot, PermissionState, ProgressCallback } from '@/types';
import { mapContact, type RawContactInput } from './contactMapper';

/**
 * Contacts to pull per page. Large enough to keep round-trips low, small enough
 * to report smooth progress on a 2k+ address book.
 */
export const PAGE_SIZE = 200;

const READ_FIELDS = [
  ContactField.FULL_NAME,
  ContactField.GIVEN_NAME,
  ContactField.FAMILY_NAME,
  ContactField.COMPANY,
  ContactField.PHONES,
] as const;

// ─── Permissions ─────────────────────────────────────────────────────────────

function toSnapshot(response: ContactsPermissionResponse): PermissionSnapshot {
  const { status, canAskAgain, accessPrivileges } = response;

  let state: PermissionState;
  if (status === PermissionStatus.GRANTED) {
    state = accessPrivileges === 'limited' ? 'limited' : 'granted';
  } else if (status === PermissionStatus.UNDETERMINED) {
    state = 'undetermined';
  } else {
    state = canAskAgain ? 'denied' : 'blocked';
  }

  return {
    state,
    canReadContacts: state === 'granted' || state === 'limited',
    canAskAgain: canAskAgain && state !== 'blocked',
  };
}

export async function getContactPermission(): Promise<PermissionSnapshot> {
  return toSnapshot(await getPermissionsAsync());
}

export async function requestContactPermission(): Promise<PermissionSnapshot> {
  return toSnapshot(await requestPermissionsAsync());
}

// ─── Reading ─────────────────────────────────────────────────────────────────

export interface ReadContactsOptions {
  /** Called after each page with (contacts scanned so far, total to scan). */
  onProgress?: ProgressCallback;
}

/**
 * Read every contact that has at least one phone number.
 *
 * Progress is reported against the raw contact count (the denominator the user
 * sees while scanning), not the filtered result length.
 */
export async function readContacts(options: ReadContactsOptions = {}): Promise<AppContact[]> {
  const { onProgress } = options;

  const total = await Contact.getCount();
  if (total === 0) {
    onProgress?.(0, 0);
    return [];
  }

  const contacts: AppContact[] = [];
  let offset = 0;

  while (offset < total) {
    const page = (await Contact.getAllDetails(READ_FIELDS, {
      limit: PAGE_SIZE,
      offset,
    })) as unknown as RawContactInput[];

    for (const raw of page) {
      const mapped = mapContact(raw);
      if (mapped) {
        contacts.push(mapped);
      }
    }

    // The address book shrank under us — stop rather than loop forever.
    if (page.length === 0) {
      break;
    }

    offset += page.length;
    onProgress?.(Math.min(offset, total), total);
  }

  return contacts;
}
