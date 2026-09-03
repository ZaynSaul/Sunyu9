/**
 * Applies a planned migration to the device address book, and undoes it.
 *
 * The only place in the app that writes to contacts. Uses the SDK 57 class API.
 *
 * `applyMigration` re-reads each contact's live phone list right before writing
 * it, then patches only the numbers that still match a planned conversion,
 * keyed on the *current* entry ids. This matters on iOS, which re-generates a
 * phone entry's identifier every time the contact is modified — the ids from
 * the earlier scan can be stale, and `patch()` keyed on a stale id drops the
 * entry (iOS) or its data row (Android), losing the number.
 *
 * Safety order:
 *   1. read the contact, build + write the patch
 *   2. record its backup entry (from the live list we just read)
 *   3. persist the growing backup every few contacts (and at the end)
 * so an interrupted run still leaves a usable Undo.
 */
import { Contact, type ExistingPhone } from 'expo-contacts';

import { saveBackup } from '@/services/contacts/contactBackup';
import type { ContactAnalysis } from '@/services/contacts/contactAnalyzer';
import { makeBatchId, planMigration, type ContactConversionPlan } from '@/services/contacts/migrationPlan';
import type {
  MigrationBackup,
  MigrationFailure,
  MigrationResult,
  PatchPhone,
  ProgressCallback,
  UndoResult,
} from '@/types';
import { friendlyPhoneLabel, nativePhoneLabel } from '@/utils/phoneLabel';

const PERSIST_EVERY = 20;

/** Drop an empty label so we never write one the user didn't set. */
function withLabel(entry: { id?: string; number: string }, label: string): PatchPhone {
  return label ? { ...entry, label } : entry;
}

interface ReconciledContact {
  /** The minimal patch payload: every live row, converted rows carrying the new number. */
  patch: PatchPhone[];
  /** The live list before the write — the backup's `originalPhones`. */
  originalPhones: PatchPhone[];
  /** The live list after the write — the backup's `newPhones`. */
  newPhones: PatchPhone[];
  /** Tags of the rows actually changing. */
  changedTags: string[];
}

/**
 * Reconcile a plan against the contact's current phone list. Numbers are matched
 * by value, so a conversion whose source number is no longer on the contact is
 * simply skipped.
 */
function reconcile(plan: ContactConversionPlan, live: ExistingPhone[]): ReconciledContact {
  const patch: PatchPhone[] = [];
  const originalPhones: PatchPhone[] = [];
  const newPhones: PatchPhone[] = [];
  const changedTags: string[] = [];

  live.forEach((phone, index) => {
    const current = phone.number ?? '';
    const friendly = friendlyPhoneLabel(phone.label);
    const id = phone.id;
    const conversion = plan.conversions.find((c) => c.from === current && c.to !== current);
    const next = conversion ? conversion.to : current;

    originalPhones.push(withLabel({ id, number: current }, friendly));
    newPhones.push(withLabel({ id, number: next }, friendly));

    if (conversion) {
      changedTags.push(id ?? `i${index}`);
    }
    // Keep every row present (so nothing is deleted), but only send a label for
    // an id-less row — for rows with an id the OS keeps the existing label.
    patch.push(id ? { id, number: next } : withLabel({ number: next }, nativePhoneLabel(friendly)));
  });

  return { patch, originalPhones, newPhones, changedTags };
}

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
      const live = (await new Contact(plan.contactId).getPhones()) as ExistingPhone[];
      const { patch, originalPhones, newPhones, changedTags } = reconcile(plan, live);

      if (changedTags.length > 0) {
        await new Contact(plan.contactId).patch({ phones: patch });
        backup.contacts.push({
          contactId: plan.contactId,
          contactName: plan.contactName,
          originalPhones,
          newPhones,
          changedPhoneTags: changedTags,
        });
        updatedContacts += 1;
        updatedNumbers += changedTags.length;
      }
      // changedTags empty → the numbers we meant to convert are no longer on
      // this contact (edited/removed since the scan). Not a failure; skip it.
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
      // The backup's ids come from the apply-time read and iOS has since
      // rotated them, so `patch()` keyed on them would drop the entries. Send
      // id-less phones instead: `patch()` treats an all-new list as a full
      // replace on both platforms, which is exactly the snapshot restore we want.
      const phones = entry.originalPhones.map((phone) =>
        withLabel({ number: phone.number }, nativePhoneLabel(phone.label ?? '')),
      );
      if (phones.length === 0) {
        throw new Error('No original phone numbers were recorded for this contact.');
      }
      await new Contact(entry.contactId).patch({ phones });
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
