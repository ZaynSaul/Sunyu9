import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, ProgressBar, Text } from '@/components/ui';
import { spacing } from '@/constants/theme';
import { shareBackup } from '@/services/contacts/backupExport';
import { useMigrationStore } from '@/store/migrationStore';
import { formatCount } from '@/utils/format';

/**
 * Settings entry that appears only when a completed migration's backup is still
 * on the device. Lets the user undo it or export it as a CSV, long after the
 * original success screen is gone.
 */
export function LastMigrationCard() {
  const backup = useMigrationStore((s) => s.backup);
  const hydrateBackup = useMigrationStore((s) => s.hydrateBackup);
  const undo = useMigrationStore((s) => s.undo);
  const undoStatus = useMigrationStore((s) => s.undoStatus);
  const undoResult = useMigrationStore((s) => s.undoResult);
  const progress = useMigrationStore((s) => s.progress);
  const error = useMigrationStore((s) => s.error);

  const [exportState, setExportState] = useState<'idle' | 'working' | 'unavailable'>('idle');

  useEffect(() => {
    void hydrateBackup();
  }, [hydrateBackup]);

  const changedNumbers = useMemo(
    () => backup?.contacts.reduce((sum, c) => sum + c.changedPhoneTags.length, 0) ?? 0,
    [backup],
  );

  if (undoStatus === 'undone') {
    return (
      <Text variant="body" tone="secondary">
        The last update was undone — {formatCount(undoResult?.restoredContacts ?? 0)} contacts
        restored.
      </Text>
    );
  }

  if (!backup) {
    return (
      <Text variant="body" tone="secondary">
        No recent update. Once you update contacts, you can undo it or save a backup file from
        here.
      </Text>
    );
  }

  const when = new Date(backup.createdAt);
  const whenLabel = Number.isNaN(when.getTime()) ? 'recently' : when.toLocaleDateString();

  if (undoStatus === 'undoing') {
    const { done, total } = progress;
    return (
      <View style={styles.block}>
        <Text variant="body">Restoring original numbers…</Text>
        <ProgressBar progress={total > 0 ? done / total : 0} indeterminate={total === 0} />
        <Text variant="caption" tone="secondary">
          {total > 0 ? `${formatCount(done)} / ${formatCount(total)}` : 'Starting…'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.block}>
      <Text variant="body">
        On {whenLabel} you updated {formatCount(changedNumbers)}{' '}
        {changedNumbers === 1 ? 'number' : 'numbers'} across {formatCount(backup.contacts.length)}{' '}
        {backup.contacts.length === 1 ? 'contact' : 'contacts'}.
      </Text>

      {undoStatus === 'error' ? (
        <Text variant="caption" tone="danger">
          {error ?? 'Undo failed.'}
        </Text>
      ) : null}
      {exportState === 'unavailable' ? (
        <Text variant="caption" tone="secondary">
          Saving a file isn’t available on this device.
        </Text>
      ) : null}

      <Button
        title="Save backup file (CSV)"
        variant="ghost"
        loading={exportState === 'working'}
        onPress={async () => {
          setExportState('working');
          try {
            setExportState((await shareBackup(backup)) ? 'idle' : 'unavailable');
          } catch {
            setExportState('unavailable');
          }
        }}
      />
      <Button title="Undo this update" variant="secondary" onPress={() => void undo()} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing.sm,
  },
});
