import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, ProgressBar, Screen, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { shareBackup } from '@/services/contacts/backupExport';
import { useAnalysisStore } from '@/store/analysisStore';
import { useContactStore } from '@/store/contactStore';
import { useMigrationStore } from '@/store/migrationStore';
import { formatCount } from '@/utils/format';

export default function SuccessScreen() {
  const result = useMigrationStore((s) => s.result);
  const backup = useMigrationStore((s) => s.backup);
  const applyStatus = useMigrationStore((s) => s.applyStatus);
  const retryFailed = useMigrationStore((s) => s.retryFailed);
  const undo = useMigrationStore((s) => s.undo);
  const undoStatus = useMigrationStore((s) => s.undoStatus);
  const undoResult = useMigrationStore((s) => s.undoResult);
  const progress = useMigrationStore((s) => s.progress);
  const error = useMigrationStore((s) => s.error);
  const resetMigration = useMigrationStore((s) => s.reset);

  const analysis = useAnalysisStore((s) => s.analysis);
  const selected = useAnalysisStore((s) => s.selected);
  const resetAnalysis = useAnalysisStore((s) => s.reset);
  const resetContacts = useContactStore((s) => s.reset);

  const [exportState, setExportState] = useState<'idle' | 'working' | 'unavailable'>('idle');

  if (!result) {
    return <Redirect href="/" />;
  }

  const finish = () => {
    // Leave the backup in storage so Undo stays possible from Settings; just
    // clear the in-flight flow so a fresh scan re-reads the updated numbers.
    resetMigration();
    resetAnalysis();
    resetContacts();
    router.replace('/');
  };

  const onExport = async () => {
    if (!backup) return;
    setExportState('working');
    try {
      const ok = await shareBackup(backup);
      setExportState(ok ? 'idle' : 'unavailable');
    } catch {
      setExportState('unavailable');
    }
  };

  if (undoStatus === 'undoing') {
    const { done, total } = progress;
    return (
      <Screen>
        <View style={styles.centered}>
          <Text variant="heading" center>
            Restoring original numbers…
          </Text>
          <View style={styles.progressBlock}>
            <ProgressBar progress={total > 0 ? done / total : 0} indeterminate={total === 0} />
            <Text variant="caption" tone="secondary" center>
              {total > 0 ? `${formatCount(done)} / ${formatCount(total)}` : 'Starting…'}
            </Text>
          </View>
        </View>
      </Screen>
    );
  }

  if (undoStatus === 'undone') {
    return (
      <Screen>
        <View style={styles.centered}>
          <Text variant="title" center>
            Original numbers restored
          </Text>
          <Text variant="body" tone="secondary" center>
            {formatCount(undoResult?.restoredContacts ?? 0)} contacts were changed back.
          </Text>
          <Button title="Done" onPress={finish} />
        </View>
      </Screen>
    );
  }

  if (applyStatus === 'applying') {
    const { done, total } = progress;
    return (
      <Screen>
        <View style={styles.centered}>
          <Text variant="heading" center>
            Retrying…
          </Text>
          <View style={styles.progressBlock}>
            <ProgressBar progress={total > 0 ? done / total : 0} indeterminate={total === 0} />
            <Text variant="caption" tone="secondary" center>
              {total > 0 ? `${formatCount(done)} / ${formatCount(total)}` : 'Starting…'}
            </Text>
          </View>
        </View>
      </Screen>
    );
  }

  const failed = result.failures.length;
  const canRetry = failed > 0 && analysis !== null;

  return (
    <Screen>
      <View style={styles.body}>
        <Text variant="title" center tone="success">
          {formatCount(result.updatedNumbers)}{' '}
          {result.updatedNumbers === 1 ? 'number' : 'numbers'} updated
        </Text>
        <Text variant="body" tone="secondary" center>
          Across {formatCount(result.updatedContacts)}{' '}
          {result.updatedContacts === 1 ? 'contact' : 'contacts'}. Apps like WhatsApp will show
          the new format once they refresh your contacts.
        </Text>

        {failed > 0 ? (
          <View style={styles.warnCard}>
            <Text variant="label" tone="danger">
              {formatCount(failed)} {failed === 1 ? 'contact' : 'contacts'} could not be updated
            </Text>
            <Text variant="caption" tone="secondary">
              They were left unchanged.
            </Text>
          </View>
        ) : null}

        {exportState === 'unavailable' ? (
          <Text variant="caption" tone="secondary" style={styles.center}>
            Saving a file isn’t available on this device.
          </Text>
        ) : null}
        {undoStatus === 'error' ? (
          <Text variant="caption" tone="danger" style={styles.center}>
            {error ?? 'Undo failed.'}
          </Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        {canRetry ? (
          <Button
            title={`Retry ${formatCount(failed)} failed`}
            variant="secondary"
            onPress={() => void retryFailed(analysis, selected)}
          />
        ) : null}
        {backup ? (
          <Button
            title="Save backup file"
            variant="ghost"
            loading={exportState === 'working'}
            onPress={() => void onExport()}
          />
        ) : null}
        {backup ? (
          <Button title="Undo changes" variant="secondary" onPress={() => void undo()} />
        ) : null}
        <Button title="Done" onPress={finish} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
  },
  progressBlock: {
    alignSelf: 'stretch',
    gap: spacing.sm,
  },
  warnCard: {
    backgroundColor: colors.dangerTint,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  center: {
    textAlign: 'center',
  },
  actions: {
    gap: spacing.md,
  },
});
