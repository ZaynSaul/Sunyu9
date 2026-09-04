/**
 * Applies a planned migration to the device address book, and undoes it.
 *
 * The only place in the app that writes to contacts. Uses the SDK 57 class API.
 *
 * Two write operations (both recorded on the backup as `operation`):
 *   • `replace` — swap a contact's old 7-digit value for its 9-digit form,
 *     in place. Undo swaps it back.
 *   • `add` — keep the old row (relabelled `"<label> (old)"`) and append a new
 *     row holding the 9-digit number, so WhatsApp keeps matching the old number
 *     until that person switches. Undo deletes the added row and restores the
 *     old row's label.
 *
 * Both `applyMigration` and `undoMigration` re-read each contact's live phone
 * list right before writing it and patch keyed on the *current* entry ids. This
 * matters on iOS, which re-generates a phone entry's identifier every time the
 * contact is modified — an id from the earlier scan / backup can be stale, and
 * `patch()` keyed on a stale id drops the entry (iOS) or its data row (Android),
 * losing the number. Numbers are matched by value, one edit consumed per row, so
 * unrelated edits the user made in between are left untouched.
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
import { makeBatchId, planConversions } from '@/services/contacts/migrationPlan';
import type {
  ContactBackup,
  MigrationBackup,
  MigrationFailure,
  MigrationOperation,
  MigrationResult,
  PatchPhone,
  ProgressCallback,
  RowChange,
  UndoResult,
} from '@/types';
import { friendlyPhoneLabel, nativePhoneLabel } from '@/utils/phoneLabel';

const PERSIST_EVERY = 20;

const norm = (value: string | null | undefined): string => (value ?? '').trim();

/** Drop an empty label so we never write one the user didn't set. */
function withLabel(entry: { id?: string; number: string }, label: string): PatchPhone {
  return label ? { ...entry, label } : entry;
}

/** The friendly label for the retained old row: `mobile` → `mobile (old)`. */
function suffixOld(friendly: string): string {
  const trimmed = friendly.trim();
  if (trimmed === '') return 'old';
  if (/\(old\)$/i.test(trimmed)) return trimmed; // already marked — idempotent re-run
  return `${trimmed} (old)`;
}

interface Replacement {
  from: string;
  to: string;
}

/** What a per-contact patch builder hands back to the apply loop. */
interface BuiltPatch {
  patch: PatchPhone[];
  /** Ids (or `iN` tags) of the rows this run changed — drives the backup + counts. */
  changedTags: string[];
  /** Snapshot of the contact's phone list *after* the write, for the backup. */
  newPhones: PatchPhone[];
  /** Per-row edits, for `add` undo. Absent for `replace`. */
  rowChanges?: RowChange[];
}

// ─── replace ─────────────────────────────────────────────────────────────────

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

function buildReplacePatch(live: ExistingPhone[], conversions: Replacement[]): BuiltPatch {
  const { patch, changedTags } = rewrite(live, conversions);
  return {
    patch,
    changedTags,
    newPhones: snapshot(live, (idx) => patch[idx].number),
  };
}

// ─── add ─────────────────────────────────────────────────────────────────────

/**
 * Keep every existing row; for each `{ from → to }`, relabel the first live row
 * still holding `from` as `"<label> (old)"` and append a new row with `to` and
 * the original label. A `from` no longer on the contact is skipped (changed
 * since the scan) — not a failure.
 */
function buildAddPatch(live: ExistingPhone[], conversions: Replacement[]): BuiltPatch {
  const pending = conversions.map((c) => ({ from: norm(c.from), to: c.to }));
  const consumed = new Set<number>();
  const changedTags: string[] = [];
  const rowChanges: RowChange[] = [];

  // Base: carry every existing row unchanged (id rows keep their OS label).
  const patch: PatchPhone[] = live.map((phone) =>
    phone.id
      ? { id: phone.id, number: norm(phone.number) }
      : withLabel({ number: norm(phone.number) }, nativePhoneLabel(friendlyPhoneLabel(phone.label))),
  );

  for (const p of pending) {
    const index = live.findIndex(
      (phone, i) => !consumed.has(i) && norm(phone.number) === p.from && p.to !== p.from,
    );
    if (index < 0) continue;
    consumed.add(index);

    const rowId = live[index].id ?? null;
    const friendly = friendlyPhoneLabel(live[index].label);
    const oldLabel = suffixOld(friendly);

    patch[index] = withLabel(
      { id: rowId ?? undefined, number: p.from },
      nativePhoneLabel(oldLabel),
    );
    patch.push(withLabel({ number: p.to }, nativePhoneLabel(friendly)));

    changedTags.push(rowId ?? `i${index}`);
    rowChanges.push({ op: 'relabel', rowId, value: p.from, fromLabel: friendly, toLabel: oldLabel });
    rowChanges.push({ op: 'add', value: p.to, label: friendly, pairedOldValue: p.from });
  }

  // The post-write snapshot, straight off the patch we're about to send.
  const liveById = new Map(live.filter((p) => p.id).map((p) => [p.id as string, p]));
  const newPhones: PatchPhone[] = patch.map((row) => {
    const friendly = row.label
      ? friendlyPhoneLabel(row.label)
      : row.id
        ? friendlyPhoneLabel(liveById.get(row.id)?.label)
        : '';
    return withLabel({ id: row.id, number: row.number }, friendly);
  });

  return { patch, changedTags, newPhones, rowChanges };
}

// ─── shared ──────────────────────────────────────────────────────────────────

/** The live list as `PatchPhone[]` (friendly labels) for a backup snapshot. */
function snapshot(live: ExistingPhone[], numberAt: (index: number) => string): PatchPhone[] {
  return live.map((phone, index) =>
    withLabel({ id: phone.id, number: numberAt(index) }, friendlyPhoneLabel(phone.label)),
  );
}

export interface ApplyMigrationParams {
  analysis: ContactAnalysis;
  selected: Set<string>;
  /** How to apply each selected conversion. Default `replace`. */
  operation?: MigrationOperation;
  onProgress?: ProgressCallback;
  /** Restrict the run to these contacts (used when retrying failures). */
  onlyContactIds?: Set<string>;
  /** Append to an existing backup batch instead of starting a new one. */
  resume?: MigrationBackup;
}

export async function applyMigration({
  analysis,
  selected,
  operation = 'replace',
  onProgress,
  onlyContactIds,
  resume,
}: ApplyMigrationParams): Promise<MigrationResult> {
  const plans = planConversions(
    analysis,
    selected,
    operation === 'add' ? 'add' : 'replace',
    onlyContactIds,
  );
  const total = plans.length;

  const backup: MigrationBackup = resume
    ? { ...resume, contacts: [...resume.contacts], status: 'applied' }
    : {
        id: makeBatchId(),
        createdAt: new Date().toISOString(),
        contacts: [],
        status: 'applied',
        operation,
      };

  const failures: MigrationFailure[] = [];
  let updatedContacts = 0;
  let updatedNumbers = 0;

  onProgress?.(0, total);

  for (let i = 0; i < total; i++) {
    const plan = plans[i];
    try {
      const live = (await new Contact(plan.contactId).getPhones()) as ExistingPhone[];
      const built =
        operation === 'add'
          ? buildAddPatch(live, plan.conversions)
          : buildReplacePatch(live, plan.conversions);

      if (built.changedTags.length > 0) {
        await new Contact(plan.contactId).patch({ phones: built.patch });
        const entry: ContactBackup = {
          contactId: plan.contactId,
          contactName: plan.contactName,
          originalPhones: snapshot(live, (idx) => norm(live[idx].number)),
          newPhones: built.newPhones,
          changedPhoneTags: built.changedTags,
        };
        if (built.rowChanges) {
          entry.rowChanges = built.rowChanges;
        }
        backup.contacts.push(entry);
        updatedContacts += 1;
        updatedNumbers += built.changedTags.length;
      }
      // changedTags empty → the numbers we meant to touch are no longer on this
      // contact (edited/removed since the scan). Not a failure; skip it.
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

  return { backupId: backup.id, operation, updatedContacts, updatedNumbers, failures };
}

// ─── undo ────────────────────────────────────────────────────────────────────

export interface UndoMigrationParams {
  backup: MigrationBackup;
  onProgress?: ProgressCallback;
}

/**
 * Undo of an `add` run: from the contact's live rows, drop the rows we added
 * (matched by value, preferring the label we recorded) and put the relabelled
 * old rows back to their original label. Anything the user added or edited since
 * is carried untouched. `appliedCount === 0` means the user already reverted it.
 */
function buildUndoAddPatch(
  entry: ContactBackup,
  live: ExistingPhone[],
): { patch: PatchPhone[]; appliedCount: number } {
  const changes = entry.rowChanges ?? [];
  const dropIdx = new Set<number>();
  const relabelAt = new Map<number, string>();
  let applied = 0;

  for (const change of changes) {
    if (change.op !== 'add') continue;
    const want = norm(change.value);
    let idx = live.findIndex(
      (p, i) =>
        !dropIdx.has(i) && norm(p.number) === want && friendlyPhoneLabel(p.label) === change.label,
    );
    if (idx < 0) {
      idx = live.findIndex((p, i) => !dropIdx.has(i) && norm(p.number) === want);
    }
    if (idx >= 0) {
      dropIdx.add(idx);
      applied += 1;
    }
  }

  for (const change of changes) {
    if (change.op !== 'relabel') continue;
    const want = norm(change.value);
    const idx = live.findIndex(
      (p, i) => !dropIdx.has(i) && !relabelAt.has(i) && norm(p.number) === want,
    );
    if (idx < 0) continue;
    relabelAt.set(idx, change.fromLabel);
    if (friendlyPhoneLabel(live[idx].label) !== change.fromLabel) {
      applied += 1;
    }
  }

  const patch: PatchPhone[] = [];
  live.forEach((phone, index) => {
    if (dropIdx.has(index)) return;
    if (relabelAt.has(index)) {
      patch.push(
        withLabel(
          { id: phone.id ?? undefined, number: norm(phone.number) },
          nativePhoneLabel(relabelAt.get(index)!),
        ),
      );
      return;
    }
    patch.push(
      phone.id
        ? { id: phone.id, number: norm(phone.number) }
        : withLabel({ number: norm(phone.number) }, nativePhoneLabel(friendlyPhoneLabel(phone.label))),
    );
  });

  return { patch, appliedCount: applied };
}

/** Undo of a `replace` run: swap every changed number back to its original. */
function buildUndoReplacePatch(
  entry: ContactBackup,
  live: ExistingPhone[],
): { patch: PatchPhone[]; appliedCount: number } {
  const restorations: Replacement[] = entry.originalPhones
    .map((original, idx) => ({
      from: norm(entry.newPhones[idx]?.number ?? original.number),
      to: original.number,
    }))
    .filter((r) => r.from !== norm(r.to));

  if (restorations.length === 0) {
    throw new Error('No changes were recorded for this contact.');
  }

  const { patch, appliedCount } = rewrite(live, restorations);
  return { patch, appliedCount };
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
      if (backup.operation === 'add' && (entry.rowChanges ?? []).length === 0) {
        throw new Error('No changes were recorded for this contact.');
      }

      const live = (await new Contact(entry.contactId).getPhones()) as ExistingPhone[];
      const { patch, appliedCount } =
        backup.operation === 'add'
          ? buildUndoAddPatch(entry, live)
          : buildUndoReplacePatch(entry, live);

      if (appliedCount > 0) {
        await new Contact(entry.contactId).patch({ phones: patch });
        restoredContacts += 1;
      }
      // appliedCount 0 → none of this run's changes are still on the contact;
      // it is already gone, nothing to undo.
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
