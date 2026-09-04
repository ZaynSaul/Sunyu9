/**
 * Local, on-device backup of the numbers changed in a migration run.
 *
 * Stored in AsyncStorage (never uploaded). Only the most recent run is kept —
 * that is the one the Undo button restores. The backup holds each affected
 * contact's *complete* original phone list, so undo is an exact snapshot
 * restore, not a guess.
 */
import { z } from 'zod';

import { getItem, removeItem, setItem } from '@/services/storage/storageService';
import type { MigrationBackup } from '@/types';

const patchPhoneSchema = z.object({
  id: z.string().optional(),
  label: z.string().optional(),
  number: z.string(),
});

const rowChangeSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('relabel'),
    rowId: z.string().nullable(),
    value: z.string(),
    fromLabel: z.string(),
    toLabel: z.string(),
  }),
  z.object({
    op: z.literal('add'),
    value: z.string(),
    label: z.string(),
    pairedOldValue: z.string(),
  }),
  z.object({
    op: z.literal('remove'),
    rowId: z.string().nullable(),
    value: z.string(),
    label: z.string(),
    pairedNewValue: z.string(),
  }),
]);

const contactBackupSchema = z.object({
  contactId: z.string(),
  contactName: z.string(),
  originalPhones: z.array(patchPhoneSchema),
  newPhones: z.array(patchPhoneSchema),
  changedPhoneTags: z.array(z.string()),
  rowChanges: z.array(rowChangeSchema).optional(),
});

export const migrationBackupSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  contacts: z.array(contactBackupSchema),
  status: z.enum(['applied', 'undone']),
  // Backups written before the two-pass feature carried no `operation` — an
  // absent value is a `replace` run; a corrupt one falls back to `replace` so a
  // bad write can never make Undo unavailable.
  operation: z.enum(['replace', 'add', 'remove']).catch('replace').default('replace'),
}) satisfies z.ZodType<MigrationBackup>;

export async function saveBackup(backup: MigrationBackup): Promise<void> {
  await setItem('migration:last', backup);
}

export async function loadBackup(): Promise<MigrationBackup | null> {
  return getItem('migration:last', migrationBackupSchema);
}

export async function clearBackup(): Promise<void> {
  await removeItem('migration:last');
}

/** A human-readable plain-text rendering of a backup, for export / support. */
export function backupToText(backup: MigrationBackup): string {
  const lines = [
    `Sunyu9 migration backup`,
    `Batch: ${backup.id}`,
    `Created: ${backup.createdAt}`,
    `Action: ${backup.operation}`,
    `Status: ${backup.status}`,
    `Contacts changed: ${backup.contacts.length}`,
    ``,
  ];
  for (const contact of backup.contacts) {
    lines.push(`${contact.contactName}`);

    const removed = new Set(
      (contact.rowChanges ?? []).filter((c) => c.op === 'remove').map((c) => c.value),
    );

    for (const phone of contact.originalPhones) {
      const tag = phone.id ?? '';
      let note = '';
      if (removed.has(phone.number)) {
        note = '  (removed)';
      } else if (contact.changedPhoneTags.includes(tag)) {
        note = '  (changed)';
      }
      lines.push(`  ${phone.label || 'other'}: ${phone.number}${note}`);
    }

    for (const change of contact.rowChanges ?? []) {
      if (change.op === 'add') {
        lines.push(`  ${change.label || 'other'}: ${change.value}  (added)`);
      }
    }

    lines.push('');
  }
  return lines.join('\n');
}
