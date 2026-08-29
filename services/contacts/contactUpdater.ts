/**
 * Applies a planned migration to the device address book, and undoes it.
 *
 * The only place in the app that writes to contacts. Uses the SDK 57 class API:
 * `new Contact(id).patch({ phones })`, which replaces the whole phone list — the
 * plan (`migrationPlan`) has already rebuilt the complete list for each contact.
 *
 * Safety order for `applyMigration`:
 *   1. write a contact
 *   2. record its backup entry
 *   3. persist the growing backup every few contacts (and at the end)
 * so an interrupted run still leaves a usable Undo.
 */
import { Contact } from 'expo-contacts';

import { saveBackup } from '@/services/contacts/contactBackup';
import type { ContactAnalysis } from '@/services/contacts/contactAnalyzer';
import { makeBatchId, planMigration } from '@/services/contacts/migrationPlan';
import type {
  MigrationBackup,
  MigrationFailure,
  MigrationResult,
  ProgressCallback,
  UndoResult,
} from '@/types';

const PERSIST_EVERY = 20;

export interface ApplyMigrationParams {
  analysis: ContactAnalysis;
  selected: Set<string>;
  onProgress?: ProgressCallback;
  /** Restrict the run to these contacts (used when retrying failures). */
  onlyContactIds?: Set<string>;
  /** Append to an existing backup batch instead of starting a new one. */
  resume?: MigrationBackup;
}

export async function applyMigration({
  analysis,
  selected,
  onProgress,
  onlyContactIds,
  resume,
}: ApplyMigrationParams): Promise<MigrationResult> {
  const plans = planMigration(analysis, selected, onlyContactIds);
  const total = plans.length;

  const backup: MigrationBackup = resume
    ? { ...resume, contacts: [...resume.contacts], status: 'applied' }
    : {
        id: makeBatchId(),
        createdAt: new Date().toISOString(),
        contacts: [],
        status: 'applied',
      };

  const failures: MigrationFailure[] = [];
  let updatedContacts = 0;
  let updatedNumbers = 0;

  onProgress?.(0, total);

  for (let i = 0; i < total; i++) {
    const plan = plans[i];
    try {
      await new Contact(plan.contactId).patch({ phones: plan.nextPhones });
      backup.contacts.push(plan.backup);
      updatedContacts += 1;
      updatedNumbers += plan.changedCount;
    } catch (error) {
      failures.push({
        contactId: plan.contactId,
        contactName: plan.contactName,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    if ((i + 1) % PERSIST_EVERY === 0 && backup.contacts.length > 0) {
      await saveBackup(backup);
    }
    onProgress?.(i + 1, total);
  }

  if (backup.contacts.length > 0) {
    await saveBackup(backup);
  }

  return { backupId: backup.id, updatedContacts, updatedNumbers, failures };
}

export interface UndoMigrationParams {
  backup: MigrationBackup;
  onProgress?: ProgressCallback;
}

export async function undoMigration({
  backup,
  onProgress,
}: UndoMigrationParams): Promise<UndoResult> {
  const total = backup.contacts.length;
  const failures: MigrationFailure[] = [];
  let restoredContacts = 0;

  onProgress?.(0, total);

  for (let i = 0; i < total; i++) {
    const entry = backup.contacts[i];
    try {
      await new Contact(entry.contactId).patch({ phones: entry.originalPhones });
      restoredContacts += 1;
    } catch (error) {
      failures.push({
        contactId: entry.contactId,
        contactName: entry.contactName,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    onProgress?.(i + 1, total);
  }

  await saveBackup({ ...backup, status: 'undone' });

  return { restoredContacts, failures };
}
