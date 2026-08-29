import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BottomSheet, Button, ProgressBar, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { shareBackup } from '@/services/contacts/backupExport';
import type { ContactAnalysis } from '@/services/contacts/contactAnalyzer';
import { selectionStats } from '@/store/analysisStore';
import { useMigrationStore } from '@/store/migrationStore';
import { formatCount } from '@/utils/format';

const ASSURANCES = [
  'The original numbers are backed up on this device first.',
  'Only the numbers you selected are changed.',
  'You can undo straight after, restoring every original number.',
  'Nothing is uploaded — this all happens on your phone.',
];

type Mode = 'confirm' | 'applying' | 'applyError' | 'success' | 'undoing' | 'undone';

interface MigrationSheetProps {
  visible: boolean;
  analysis: ContactAnalysis;
  selected: Set<string>;
  /** Dismiss without having changed anything (confirm / error only). */
  onCancel: () => void;
  /** The whole run is finished with — reset state and leave the flow. */
  onDone: () => void;
}

/**
 * The entire write phase in one sheet: confirm -> progress -> result, plus undo,
 * retry and backup export. Replaces the old `/updating` and `/success` routes so
 * the flow never leaves the review screen.
 */
export function MigrationSheet({ visible, analysis, selected, onCancel, onDone }: MigrationSheetProps) {
  const apply = useMigrationStore((s) => s.apply);
  const applyStatus = useMigrationStore((s) => s.applyStatus);
  const retryFailed = useMigrationStore((s) => s.retryFailed);
  const undo = useMigrationStore((s) => s.undo);
  const undoStatus = useMigrationStore((s) => s.undoStatus);
  const undoResult = useMigrationStore((s) => s.undoResult);
  const progress = useMigrationStore((s) => s.progress);
  const result = useMigrationStore((s) => s.result);
  const backup = useMigrationStore((s) => s.backup);
  const error = useMigrationStore((s) => s.error);

  const [exportState, setExportState] = useState<'idle' | 'working' | 'unavailable'>('idle');

  const stats = selectionStats(analysis, selected);
  const noun = stats.numbers === 1 ? 'number' : 'numbers';

  const mode: Mode =
    undoStatus === 'undoing'
      ? 'undoing'
      : undoStatus === 'undone'
        ? 'undone'
        : applyStatus === 'applying'
          ? 'applying'
          : applyStatus === 'error'
            ? 'applyError'
            : applyStatus === 'done'
              ? 'success'
              : 'confirm';

  const busy = mode === 'applying' || mode === 'undoing';
  // In a terminal state the only way out is "Done"; a stray backdrop tap there
  // should finish rather than strand the user on stale review data.
  const handleClose = mode === 'confirm' || mode === 'applyError' ? onCancel : onDone;

  const onExport = async () => {
    if (!backup) return;
    setExportState('working');
    try {
      setExportState((await shareBackup(backup)) ? 'idle' : 'unavailable');
    } catch {
      setExportState('unavailable');
    }
  };

  const { done, total } = progress;
  const ratio = total > 0 ? done / total : 0;

  return (
    <BottomSheet visible={visible} onClose={handleClose} dismissible={!busy}>
      {mode === 'confirm' ? (
        <>
          <Text variant="title">
            Update {formatCount(stats.numbers)} {noun}?
          </Text>
          <Text variant="body" tone="secondary" style={styles.lede}>
            This changes {formatCount(stats.numbers)} {noun} across {formatCount(stats.contacts)}{' '}
            {stats.contacts === 1 ? 'contact' : 'contacts'} to the new 9-digit format.
          </Text>

          <View style={styles.card}>
            {ASSURANCES.map((line) => (
              <View key={line} style={styles.assuranceRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={colors.accentGreen}
                  style={styles.assuranceIcon}
                />
                <Text variant="body" style={styles.assuranceText}>
                  {line}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.actions}>
            <Button
              title={`Update ${formatCount(stats.numbers)} ${noun}`}
              onPress={() => void apply(analysis, selected)}
            />
            <Button title="Cancel" variant="ghost" onPress={onCancel} />
          </View>
        </>
      ) : null}

      {mode === 'applying' || mode === 'undoing' ? (
        <>
          <Text variant="title">
            {mode === 'applying' ? 'Updating contacts…' : 'Restoring original numbers…'}
          </Text>
          <Text variant="body" tone="secondary" style={styles.lede}>
            {mode === 'applying'
              ? 'Keep the app open. The original numbers are being backed up as we go.'
              : 'Keep the app open.'}
          </Text>
          <View style={styles.progressBlock}>
            <ProgressBar progress={ratio} indeterminate={total === 0} />
            <Text variant="caption" tone="secondary">
              {total > 0 ? `${formatCount(done)} / ${formatCount(total)}` : 'Starting…'}
            </Text>
          </View>
        </>
      ) : null}

      {mode === 'applyError' ? (
        <>
          <Text variant="title" tone="danger">
            The update stopped
          </Text>
          <Text variant="body" tone="secondary" style={styles.lede}>
            {error ?? 'Something went wrong.'} Any changes already made are backed up and can be
            undone.
          </Text>
          <View style={styles.actions}>
            <Button title="Try again" onPress={() => void apply(analysis, selected)} />
            <Button title="Back to review" variant="ghost" onPress={onCancel} />
          </View>
        </>
      ) : null}

      {mode === 'success' ? (
        <>
          <Text variant="title" tone="success">
            {formatCount(result?.updatedNumbers ?? 0)}{' '}
            {(result?.updatedNumbers ?? 0) === 1 ? 'number' : 'numbers'} updated
          </Text>
          <Text variant="body" tone="secondary" style={styles.lede}>
            Across {formatCount(result?.updatedContacts ?? 0)}{' '}
            {(result?.updatedContacts ?? 0) === 1 ? 'contact' : 'contacts'}. Apps like WhatsApp
            will show the new format once they refresh your contacts.
          </Text>

          {result && result.failures.length > 0 ? (
            <View style={styles.warnCard}>
              <Text variant="label" tone="danger">
                {formatCount(result.failures.length)}{' '}
                {result.failures.length === 1 ? 'contact' : 'contacts'} could not be updated
              </Text>
              <Text variant="caption" tone="secondary">
                Some contacts come from apps like WhatsApp or a SIM card and cannot be edited here.
                They were left unchanged.
              </Text>
            </View>
          ) : null}

          {undoStatus === 'error' ? (
            <Text variant="caption" tone="danger" style={styles.note}>
              {error ?? 'Undo failed.'}
            </Text>
          ) : null}
          {exportState === 'unavailable' ? (
            <Text variant="caption" tone="secondary" style={styles.note}>
              Saving a file isn’t available on this device.
            </Text>
          ) : null}

          <View style={styles.actions}>
            {result && result.failures.length > 0 ? (
              <Button
                title={`Retry ${formatCount(result.failures.length)} failed`}
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
            <Button title="Done" onPress={onDone} />
          </View>
        </>
      ) : null}

      {mode === 'undone' ? (
        <>
          <Text variant="title">Original numbers restored</Text>
          <Text variant="body" tone="secondary" style={styles.lede}>
            {formatCount(undoResult?.restoredContacts ?? 0)}{' '}
            {(undoResult?.restoredContacts ?? 0) === 1 ? 'contact was' : 'contacts were'} changed
            back.
          </Text>
          <View style={styles.actions}>
            <Button title="Done" onPress={onDone} />
          </View>
        </>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  lede: {
    marginTop: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  assuranceRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  assuranceIcon: {
    marginTop: 1,
  },
  assuranceText: {
    flex: 1,
  },
  warnCard: {
    backgroundColor: colors.dangerTint,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
  progressBlock: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  note: {
    marginTop: spacing.md,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
});
