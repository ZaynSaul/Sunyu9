/**
 * Applies a planned migration to the device address book, and undoes it.
 *
 * The only place in the app that writes to contacts. Uses the SDK 57 class API.
 *
 * Both `applyMigration` and `undoMigration` re-read each contact's live phone
 * list right before writing it and patch keyed on the *current* entry ids. This
 * matters on iOS, which re-generates a phone entry's identifier every time the
 * contact is modified — an id from the earlier scan / backup can be stale, and
 * `patch()` keyed on a stale id drops the entry (iOS) or its data row (Android),
 * losing the number. Numbers are matched by value, one replacement consumed per
 * row, so unrelated edits the user made in between are left untouched.
 *
 * Safety order for apply:
 *   1. read the contact, build + write the patch
 *   2. record its backup entry (from the live list we just read)
 *   3. persist the growing backup every few contacts (and at the end)
 * so an interrupted run still leaves a usable Undo.
 */
import { Contact, type ExistingPhone } from 'expo-contacts';

import { saveBackup } from '@/services/contacts/contactBackup';
import type { ContactAnalysis } from '@/services/contacts/contactAnalyzer';
import { makeBatchId, planMigration } from '@/services/contacts/migrationPlan';
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

const norm = (value: string | null | undefined): string => (value ?? '').trim();

/** Drop an empty label so we never write one the user didn't set. */
function withLabel(entry: { id?: string; number: string }, label: string): PatchPhone {
  return label ? { ...entry, label } : entry;
}

interface Replacement {
  from: string;
  to: string;
}

/**
 * Rewrite a contact's live phone list, swapping each `{ from → to }` into the
 * first row that still holds `from` (one replacement per row). Every row is kept
 * in the payload so nothing is deleted; rows with an id carry no label so the OS
 * keeps the existing one.
 */
function rewrite(
  live: ExistingPhone[],
  replacements: Replacement[],
): { patch: PatchPhone[]; changedTags: string[]; appliedCount: number } {
  const pending = replacements.map((r) => ({ from: norm(r.from), to: r.to }));
  const before = pending.length;
  const patch: PatchPhone[] = [];
  const changedTags: string[] = [];

  live.forEach((phone, index) => {
    const current = norm(phone.number);
    const hit = pending.findIndex((r) => r.from === current && r.to !== current);
    const next = hit >= 0 ? pending.splice(hit, 1)[0].to : current;

    if (next !== current) {
      changedTags.push(phone.id ?? `i${index}`);
    }
    patch.push(
      phone.id
        ? { id: phone.id, number: next }
        : withLabel({ number: next }, nativePhoneLabel(friendlyPhoneLabel(phone.label))),
    );
  });

  return { patch, changedTags, appliedCount: before - pending.length };
}

/** The live list as `PatchPhone[]` (friendly labels) for a backup snapshot. */
function snapshot(live: ExistingPhone[], numberAt: (index: number) => string): PatchPhone[] {
  return live.map((phone, index) =>
    withLabel({ id: phone.id, number: numberAt(index) }, friendlyPhoneLabel(phone.label)),
  );
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
      const { patch, changedTags } = rewrite(live, plan.conversions);

      if (changedTags.length > 0) {
        await new Contact(plan.contactId).patch({ phones: patch });
        backup.contacts.push({
          contactId: plan.contactId,
          contactName: plan.contactName,
          originalPhones: snapshot(live, (idx) => norm(live[idx].number)),
          newPhones: snapshot(live, (idx) => patch[idx].number),
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
      // Revert just the numbers this run changed (new value → original), matched
      // against the contact's live rows by value — so a phone the user added or
      // corrected between apply and undo is left alone.
      const restorations: Replacement[] = entry.originalPhones
        .map((original, idx) => ({
          from: norm(entry.newPhones[idx]?.number ?? original.number),
          to: original.number,
        }))
        .filter((r) => r.from !== norm(r.to));

      if (restorations.length === 0) {
        throw new Error('No changes were recorded for this contact.');
      }

      const live = (await new Contact(entry.contactId).getPhones()) as ExistingPhone[];
      const { patch, appliedCount } = rewrite(live, restorations);

      if (appliedCount > 0) {
        await new Contact(entry.contactId).patch({ phones: patch });
        restoredContacts += 1;
      }
      // appliedCount 0 → none of this run's converted numbers are still on the
      // contact; the change is already gone, nothing to undo.
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
