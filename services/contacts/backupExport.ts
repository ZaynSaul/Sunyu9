/**
 * Exports a migration backup as a CSV file the user can keep or hand to someone
 * else — a second safety net on top of in-app Undo, and useful for the
 * "let a relative check it" and small-business flows.
 *
 * Writes to the app cache and opens the system share sheet (`expo-sharing`), so
 * the user chooses where it lands (Files, Drive, WhatsApp, …). No network.
 */
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { MigrationBackup } from '@/types';

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Pure: render a backup as CSV text (`Contact,Label,Old,New,Changed`). */
export function backupToCsv(backup: MigrationBackup): string {
  const rows: string[][] = [['Contact', 'Label', 'Old number', 'New number', 'Changed']];

  for (const contact of backup.contacts) {
    contact.originalPhones.forEach((original, index) => {
      const next = contact.newPhones[index];
      const newNumber = next?.number ?? original.number;
      rows.push([
        contact.contactName,
        original.label,
        original.number,
        newNumber,
        original.number === newNumber ? 'no' : 'yes',
      ]);
    });
  }

  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

export function backupFilename(backup: MigrationBackup): string {
  return `sunyu9-backup-${backup.id.replace(/^mig_/, '')}.csv`;
}

/** Write the CSV to the cache dir and return its `file://` URI. */
export function writeBackupCsv(backup: MigrationBackup): string {
  const file = new File(Paths.cache, backupFilename(backup));
  if (file.exists) {
    file.delete();
  }
  file.create();
  file.write(backupToCsv(backup));
  return file.uri;
}

/** Write + open the share sheet. Returns `false` if sharing is unavailable. */
export async function shareBackup(backup: MigrationBackup): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) {
    return false;
  }
  const uri = writeBackupCsv(backup);
  await Sharing.shareAsync(uri, {
    mimeType: 'text/csv',
    dialogTitle: 'Save your Sunyu9 backup',
    UTI: 'public.comma-separated-values-text',
  });
  return true;
}
