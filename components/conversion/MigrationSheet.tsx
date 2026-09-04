import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BottomSheet, Button, ProgressBar, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { shareBackup } from '@/services/contacts/backupExport';
import type { ContactAnalysis } from '@/services/contacts/contactAnalyzer';
import { selectionStats } from '@/store/analysisStore';
import { useMigrationStore, type ApplyOperation } from '@/store/migrationStore';
import { formatCount } from '@/utils/format';

const ASSURANCES: Record<ApplyOperation, string[]> = {
  add: [
    'Your numbers are saved on this phone first.',
    'Only the numbers you picked get a new number added.',
    'Undo any time — the new numbers come off and the old labels go back.',
    'Nothing goes online. It all happens on your phone.',
  ],
  replace: [
    'Your original numbers are saved on this phone first.',
    'Only the numbers you picked are changed.',
    'Undo any time — every original number is put back.',
    'Nothing goes online. It all happens on your phone.',
  ],
};

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
 * The entire write phase in one sheet: pick how to update -> confirm ->
 * progress -> result, plus undo, retry and backup export. The flow never leaves
 * the review screen.
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

  const [choice, setChoice] = useState<ApplyOperation>('add');
  const [exportState, setExportState] = useState<'idle' | 'working' | 'unavailable'>('idle');

  const stats = selectionStats(analysis, selected);
  const noun = stats.numbers === 1 ? 'number' : 'numbers';

  // A real example off the first picked number, to show what will happen.
  const example = firstPickedExample(analysis, selected);

  // The operation actually run is captured on the result, so progress / success
  // copy stay correct even if `choice` re-renders.
  const runOp: ApplyOperation = result?.operation === 'replace' ? 'replace' : 'add';

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
            In {formatCount(stats.contacts)} {stats.contacts === 1 ? 'contact' : 'contacts'}. Pick how
            you want it done — you can undo either one.
          </Text>

          <View style={styles.choices}>
            <ChoiceCard
              selected={choice === 'add'}
              recommended
              title="Keep both numbers"
              caption="Adds the new number and keeps the old one. Your contacts still show their names in WhatsApp. Remove the old numbers later."
              onPress={() => setChoice('add')}
            />
            <ChoiceCard
              selected={choice === 'replace'}
              title="Switch to the new number now"
              caption="Replaces the old number. Best once your contacts already use their new number, or after 30 November."
              onPress={() => setChoice('replace')}
            />
          </View>

          {example ? <NumberPreview old={example.old} next={example.next} choice={choice} /> : null}

          <View style={styles.card}>
            {ASSURANCES[choice].map((line) => (
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
              title={
                choice === 'add'
                  ? `Add the new number for ${formatCount(stats.numbers)} ${noun}`
                  : `Switch ${formatCount(stats.numbers)} ${noun}`
              }
              disabled={stats.numbers === 0}
              onPress={() => void apply(analysis, selected, choice)}
            />
            <Button title="Cancel" variant="ghost" onPress={onCancel} />
          </View>
        </>
      ) : null}

      {mode === 'applying' || mode === 'undoing' ? (
        <>
          <Text variant="title">
            {mode === 'applying' ? 'Updating contacts…' : 'Putting numbers back…'}
          </Text>
          <Text variant="body" tone="secondary" style={styles.lede}>
            {mode === 'applying'
              ? 'Keep the app open. Your original numbers are being saved as we go.'
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
            {error ?? 'Something went wrong.'} Any changes already made are saved and can be undone.
          </Text>
          <View style={styles.actions}>
            <Button title="Try again" onPress={() => void apply(analysis, selected, choice)} />
            <Button title="Back to review" variant="ghost" onPress={onCancel} />
          </View>
        </>
      ) : null}

      {mode === 'success' ? (
        <>
          <Text variant="title" tone="success">
            {runOp === 'add' ? 'New numbers added' : 'Numbers switched'}
          </Text>
          <Text variant="body" tone="secondary" style={styles.lede}>
            {runOp === 'add'
              ? `Added for ${formatCount(result?.updatedNumbers ?? 0)} ${
                  (result?.updatedNumbers ?? 0) === 1 ? 'number' : 'numbers'
                } in ${formatCount(result?.updatedContacts ?? 0)} ${
                  (result?.updatedContacts ?? 0) === 1 ? 'contact' : 'contacts'
                }. Both numbers are saved now — WhatsApp keeps using the old one until your contact switches. Come back later to remove the old numbers.`
              : `${formatCount(result?.updatedNumbers ?? 0)} ${
                  (result?.updatedNumbers ?? 0) === 1 ? 'number' : 'numbers'
                } in ${formatCount(result?.updatedContacts ?? 0)} ${
                  (result?.updatedContacts ?? 0) === 1 ? 'contact' : 'contacts'
                }. If a contact hasn’t updated their own WhatsApp yet, their chat may show a plain number until they do.`}
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
              <Button title="Undo this" variant="secondary" onPress={() => void undo()} />
            ) : null}
            <Button title="Done" onPress={onDone} />
          </View>
        </>
      ) : null}

      {mode === 'undone' ? (
        <>
          <Text variant="title">Numbers put back</Text>
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

/** The first selected, not-yet-paired convertible number — for the preview. */
function firstPickedExample(
  analysis: ContactAnalysis,
  selected: Set<string>,
): { old: string; next: string } | null {
  for (const contact of analysis.actionable) {
    for (const number of contact.numbers) {
      if (
        number.outcome.status === 'convertible' &&
        !number.alreadyPaired &&
        selected.has(number.key)
      ) {
        return { old: number.phone.original, next: number.outcome.display };
      }
    }
  }
  return null;
}

// ── sub-views ────────────────────────────────────────────────────────────────

function ChoiceCard({
  selected,
  recommended,
  title,
  caption,
  onPress,
}: {
  selected: boolean;
  recommended?: boolean;
  title: string;
  caption: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceOn]}
    >
      <Ionicons
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={22}
        color={selected ? colors.brand : colors.textSecondary}
        style={styles.choiceRadio}
      />
      <View style={styles.choiceBody}>
        <View style={styles.choiceTitleRow}>
          <Text variant="body" weight="semibold">
            {title}
          </Text>
          {recommended ? (
            <View style={styles.recommendPill}>
              <Text style={styles.recommendText}>Recommended</Text>
            </View>
          ) : null}
        </View>
        <Text variant="caption" tone="secondary">
          {caption}
        </Text>
      </View>
    </Pressable>
  );
}

function NumberPreview({
  old,
  next,
  choice,
}: {
  old: string;
  next: string;
  choice: ApplyOperation;
}) {
  if (choice === 'add') {
    return (
      <View style={styles.preview}>
        <View style={styles.previewRow}>
          <Text variant="caption" tone="secondary" style={styles.previewTag}>
            Old
          </Text>
          <Text variant="body" style={styles.previewNum}>
            {old}
          </Text>
          <Ionicons name="checkmark-circle" size={16} color={colors.accentGreen} />
        </View>
        <View style={styles.previewRow}>
          <Text variant="caption" tone="secondary" style={styles.previewTag}>
            New
          </Text>
          <Text variant="body" weight="semibold" style={styles.previewNum}>
            {next}
          </Text>
          <Ionicons name="add-circle" size={16} color={colors.brand} />
        </View>
        <Text variant="caption" tone="secondary">
          Both numbers stay on the contact.
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.preview}>
      <View style={styles.previewRow}>
        <Text variant="body" tone="secondary" style={styles.previewStrike}>
          {old}
        </Text>
        <Ionicons name="arrow-forward" size={15} color={colors.textSecondary} />
        <Text variant="body" weight="semibold">
          {next}
        </Text>
      </View>
      <Text variant="caption" tone="secondary">
        The old number is replaced.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  lede: {
    marginTop: spacing.xs,
  },
  choices: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  choice: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'flex-start',
  },
  choiceOn: {
    borderColor: colors.brand,
    backgroundColor: colors.brandTint,
  },
  choiceRadio: {
    marginTop: 1,
  },
  choiceBody: {
    flex: 1,
    gap: 2,
  },
  choiceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  recommendPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.accentGreenTint,
  },
  recommendText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accentGreen,
  },
  preview: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  previewTag: {
    width: 32,
  },
  previewNum: {
    flex: 1,
    fontVariant: ['tabular-nums'],
  },
  previewStrike: {
    textDecorationLine: 'line-through',
    fontVariant: ['tabular-nums'],
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
