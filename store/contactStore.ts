/**
 * Global contact state: holds the permission snapshot, drives the read, and
 * exposes the resulting `AppContact[]` plus scan progress to the screens.
 * Nothing is persisted here — contacts live in memory only and are re-read on
 * demand.
 */
import { create } from 'zustand';

import {
  getContactPermission,
  readContacts,
  requestContactPermission,
} from '@/services/contacts/contactReader';
import type { AppContact, PermissionSnapshot } from '@/types';

export type ContactStatus = 'idle' | 'reading' | 'ready' | 'error';

interface ScanProgress {
  processed: number;
  total: number;
}

interface ContactState {
  permission: PermissionSnapshot | null;
  contacts: AppContact[];
  status: ContactStatus;
  progress: ScanProgress;
  error: string | null;

  /** Read the current permission without prompting. */
  refreshPermission: () => Promise<PermissionSnapshot>;
  /** Prompt for permission (or deep-link intent handled by the caller). */
  requestPermission: () => Promise<PermissionSnapshot>;
  /** Read all contacts into the store, reporting progress. */
  loadContacts: () => Promise<void>;
  /** Clear contacts and progress (keeps the last known permission). */
  reset: () => void;
}

const INITIAL_PROGRESS: ScanProgress = { processed: 0, total: 0 };

export const useContactStore = create<ContactState>((set, get) => ({
  permission: null,
  contacts: [],
  status: 'idle',
  progress: INITIAL_PROGRESS,
  error: null,

  refreshPermission: async () => {
    const permission = await getContactPermission();
    set({ permission });
    return permission;
  },

  requestPermission: async () => {
    const permission = await requestContactPermission();
    set({ permission });
    return permission;
  },

  loadContacts: async () => {
    if (get().status === 'reading') {
      return;
    }
    set({ status: 'reading', error: null, progress: INITIAL_PROGRESS });
    try {
      const contacts = await readContacts({
        onProgress: (processed, total) => set({ progress: { processed, total } }),
      });
      set({ contacts, status: 'ready' });
    } catch (error) {
      console.warn('[contactStore] failed to read contacts', error);
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'Could not read contacts.',
      });
    }
  },

  reset: () => set({ contacts: [], status: 'idle', progress: INITIAL_PROGRESS, error: null }),
}));
