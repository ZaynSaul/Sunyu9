/**
 * Drives the write phase: apply the selected conversions, then optionally undo.
 *
 * Reads its inputs (analysis + selection) from `analysisStore` at apply time.
 * Keeps the backup + result so the success screen can offer Undo, and can pick
 * up an existing backup after an app restart.
 */
import { create } from 'zustand';

import { clearBackup, loadBackup } from '@/services/contacts/contactBackup';
import { applyMigration, undoMigration } from '@/services/contacts/contactUpdater';
import type { ContactAnalysis } from '@/services/contacts/contactAnalyzer';
import type { MigrationBackup, MigrationResult, UndoResult } from '@/types';

export type ApplyStatus = 'idle' | 'applying' | 'done' | 'error';
export type UndoStatus = 'idle' | 'undoing' | 'undone' | 'error';

interface Progress {
  done: number;
  total: number;
}

interface MigrationState {
  applyStatus: ApplyStatus;
  undoStatus: UndoStatus;
  progress: Progress;
  result: MigrationResult | null;
  undoResult: UndoResult | null;
  backup: MigrationBackup | null;
  error: string | null;

  apply: (analysis: ContactAnalysis, selected: Set<string>) => Promise<void>;
  /** Re-run only the contacts that failed in the last apply, merging results. */
  retryFailed: (analysis: ContactAnalysis, selected: Set<string>) => Promise<void>;
  undo: () => Promise<void>;
  /** Load a backup left by a previous session (so Undo survives a restart). */
  hydrateBackup: () => Promise<void>;
  /** Forget the backup — the user accepted the changes. */
  discardBackup: () => Promise<void>;
  reset: () => void;
}

const INITIAL_PROGRESS: Progress = { done: 0, total: 0 };

export const useMigrationStore = create<MigrationState>((set, get) => ({
  applyStatus: 'idle',
  undoStatus: 'idle',
  progress: INITIAL_PROGRESS,
  result: null,
  undoResult: null,
  backup: null,
  error: null,

  apply: async (analysis, selected) => {
    if (get().applyStatus === 'applying') {
      return;
    }
    set({ applyStatus: 'applying', error: null, progress: INITIAL_PROGRESS, result: null });
    try {
      const result = await applyMigration({
        analysis,
        selected,
        onProgress: (done, total) => set({ progress: { done, total } }),
      });
      const backup = await loadBackup();
      set({ applyStatus: 'done', result, backup, undoStatus: 'idle', undoResult: null });
    } catch (error) {
      console.warn('[migrationStore] apply failed', error);
      set({
        applyStatus: 'error',
        error: error instanceof Error ? error.message : 'The update could not be completed.',
      });
    }
  },

  retryFailed: async (analysis, selected) => {
    const { result, backup, applyStatus } = get();
    if (!result || result.failures.length === 0 || applyStatus === 'applying') {
      return;
    }
    const failedIds = new Set(result.failures.map((f) => f.contactId));
    set({ applyStatus: 'applying', error: null, progress: INITIAL_PROGRESS });
    try {
      const retry = await applyMigration({
        analysis,
        selected,
        onlyContactIds: failedIds,
        resume: backup ?? undefined,
        onProgress: (done, total) => set({ progress: { done, total } }),
      });
      const merged: MigrationResult = {
        backupId: result.backupId,
        updatedContacts: result.updatedContacts + retry.updatedContacts,
        updatedNumbers: result.updatedNumbers + retry.updatedNumbers,
        failures: retry.failures,
      };
      const refreshed = await loadBackup();
      set({ applyStatus: 'done', result: merged, backup: refreshed });
    } catch (error) {
      console.warn('[migrationStore] retry failed', error);
      set({
        applyStatus: 'error',
        error: error instanceof Error ? error.message : 'Retry could not be completed.',
      });
    }
  },

  undo: async () => {
    const { backup, undoStatus } = get();
    if (!backup || undoStatus === 'undoing') {
      return;
    }
    set({ undoStatus: 'undoing', error: null, progress: INITIAL_PROGRESS });
    try {
      const undoResult = await undoMigration({
        backup,
        onProgress: (done, total) => set({ progress: { done, total } }),
      });
      await clearBackup();
      set({ undoStatus: 'undone', undoResult, backup: null });
    } catch (error) {
      console.warn('[migrationStore] undo failed', error);
      set({
        undoStatus: 'error',
        error: error instanceof Error ? error.message : 'Could not restore the original numbers.',
      });
    }
  },

  hydrateBackup: async () => {
    const backup = await loadBackup();
    if (backup && backup.status === 'applied') {
      set({ backup });
    }
  },

  discardBackup: async () => {
    await clearBackup();
    set({ backup: null });
  },

  reset: () =>
    set({
      applyStatus: 'idle',
      undoStatus: 'idle',
      progress: INITIAL_PROGRESS,
      result: null,
      undoResult: null,
      backup: null,
      error: null,
    }),
}));
