import { Redirect, router, useNavigation } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  StyleSheet,
  View,
  type ListRenderItem,
} from 'react-native';

import { ContactResultCard } from '@/components/conversion/ContactResultCard';
import { MigrationSheet } from '@/components/conversion/MigrationSheet';
import { Button, ProgressBar, Screen, Text } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import type { AnalyzedContact } from '@/services/contacts/contactAnalyzer';
import { selectionStats, useAnalysisStore } from '@/store/analysisStore';
import { useContactStore } from '@/store/contactStore';
import { useMigrationStore } from '@/store/migrationStore';
import { formatCount } from '@/utils/format';

export default function ResultsScreen() {
  const navigation = useNavigation();

  const permission = useContactStore((s) => s.permission);
  const contactStatus = useContactStore((s) => s.status);
  const contactProgress = useContactStore((s) => s.progress);
  const contacts = useContactStore((s) => s.contacts);
  const contactError = useContactStore((s) => s.error);
  const loadContacts = useContactStore((s) => s.loadContacts);
  const refreshPermission = useContactStore((s) => s.refreshPermission);
  const resetContacts = useContactStore((s) => s.reset);

  const status = useAnalysisStore((s) => s.status);
  const analysis = useAnalysisStore((s) => s.analysis);
  const selected = useAnalysisStore((s) => s.selected);
  const analyzeProgress = useAnalysisStore((s) => s.progress);
  const analysisError = useAnalysisStore((s) => s.error);
  const analyze = useAnalysisStore((s) => s.analyze);
  const toggleNumber = useAnalysisStore((s) => s.toggleNumber);
  const setContactSelected = useAnalysisStore((s) => s.setContactSelected);
  const selectAll = useAnalysisStore((s) => s.selectAll);
  const selectNone = useAnalysisStore((s) => s.selectNone);
  const resetAnalysis = useAnalysisStore((s) => s.reset);

  const applyStatus = useMigrationStore((s) => s.applyStatus);
  const undoStatus = useMigrationStore((s) => s.undoStatus);
  const resetMigration = useMigrationStore((s) => s.reset);

  const [sheetOpen, setSheetOpen] = useState(false);

  const busy = applyStatus === 'applying' || undoStatus === 'undoing';

  // ── flow orchestration ─────────────────────────────────────────────────────
  useEffect(() => {
    if (permission === null) void refreshPermission();
  }, [permission, refreshPermission]);

  useEffect(() => {
    if (permission?.canReadContacts && contactStatus === 'idle') void loadContacts();
  }, [permission?.canReadContacts, contactStatus, loadContacts]);

  useEffect(() => {
    if (contactStatus === 'ready' && status === 'idle') void analyze(contacts);
  }, [contactStatus, status, contacts, analyze]);

  // ── lock navigation while a write is in flight ─────────────────────────────
  useEffect(() => {
    navigation.setOptions({ headerBackVisible: !busy, gestureEnabled: !busy });
  }, [busy, navigation]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => busy);
    return () => sub.remove();
  }, [busy]);

  const handleDone = useCallback(() => {
    resetMigration();
    resetAnalysis();
    resetContacts();
    if (router.canDismiss()) router.dismissAll();
    router.replace('/');
  }, [resetMigration, resetAnalysis, resetContacts]);

  const renderItem = useCallback<ListRenderItem<AnalyzedContact>>(
    ({ item }) => (
      <ContactResultCard
        analyzed={item}
        selectedKeys={selected}
        onToggleNumber={toggleNumber}
        onToggleContact={setContactSelected}
      />
    ),
    [selected, toggleNumber, setContactSelected],
  );

  // ── permission gate ────────────────────────────────────────────────────────
  if (permission && !permission.canReadContacts) {
    return <Redirect href="/" />;
  }

  // ── reading contacts ───────────────────────────────────────────────────────
  if (contactStatus === 'idle' || contactStatus === 'reading') {
    return (
      <LoadingState
        title="Reading your contacts…"
        progress={contactProgress.total > 0 ? contactProgress.processed / contactProgress.total : 0}
        indeterminate={contactProgress.total === 0}
        caption={
          contactProgress.total > 0
            ? `${formatCount(contactProgress.processed)} / ${formatCount(contactProgress.total)}`
            : 'Getting started…'
        }
      />
    );
  }

  if (contactStatus === 'error') {
    return (
      <ErrorState
        title="Could not read your contacts"
        message={contactError}
        onRetry={() => void loadContacts()}
      />
    );
  }

  // ── analysing numbers ──────────────────────────────────────────────────────
  if (status === 'idle' || status === 'analyzing' || !analysis) {
    return (
      <LoadingState
        title="Checking your numbers…"
        body="Every number is checked against the official 9-digit plan. Nothing is changed yet."
        progress={analyzeProgress.total > 0 ? analyzeProgress.done / analyzeProgress.total : 0}
        indeterminate={analyzeProgress.total === 0}
        caption={
          analyzeProgress.total > 0
            ? `${formatCount(analyzeProgress.done)} / ${formatCount(analyzeProgress.total)}`
            : 'Starting…'
        }
      />
    );
  }

  if (status === 'error') {
    return (
      <ErrorState
        title="Could not check your numbers"
        message={analysisError}
        onRetry={() => void analyze(contacts)}
      />
    );
  }

  // ── review ─────────────────────────────────────────────────────────────────
  const { summary } = analysis;
  const stats = selectionStats(analysis, selected);
  const allSelected = stats.numbers === summary.convertibleNumbers && summary.convertibleNumbers > 0;

  if (analysis.actionable.length === 0) {
    return (
      <Screen>
        <View style={styles.empty}>
          <Text variant="title" center tone="success">
            Your contacts are up to date
          </Text>
          <Text variant="body" tone="secondary" center>
            We checked {formatCount(summary.numbersScanned)} numbers in{' '}
            {formatCount(summary.contactsScanned)} contacts. None of them use the old 7-digit
            format.
          </Text>
          <Button title="Done" onPress={handleDone} />
        </View>
      </Screen>
    );
  }

  return (
    <View style={styles.fill}>
      <FlatList
        data={analysis.actionable}
        renderItem={renderItem}
        keyExtractor={(item) => item.contact.id}
        style={styles.listFlex}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={9}
        removeClippedSubviews
        ListHeaderComponent={
          <View style={styles.header}>
            <Text variant="title">
              {formatCount(summary.convertibleNumbers)}{' '}
              {summary.convertibleNumbers === 1 ? 'number' : 'numbers'} to update
            </Text>
            <Text variant="body" tone="secondary">
              In {formatCount(summary.actionableContacts)}{' '}
              {summary.actionableContacts === 1 ? 'contact' : 'contacts'}. Review below, then
              update the ones you want. Nothing is saved until you confirm.
            </Text>
            <View style={styles.metaRow}>
              {summary.alreadyMigrated > 0 ? (
                <Text variant="caption" tone="secondary">
                  {formatCount(summary.alreadyMigrated)} already new
                </Text>
              ) : null}
              {summary.notApplicable + summary.invalid > 0 ? (
                <Text variant="caption" tone="secondary">
                  {formatCount(summary.notApplicable + summary.invalid)} left unchanged
                </Text>
              ) : null}
              <Text
                variant="caption"
                tone="brand"
                onPress={() => router.push('/contacts')}
                style={styles.link}
              >
                See all {formatCount(summary.contactsScanned)} contacts
              </Text>
            </View>
            <Text
              variant="label"
              tone="brand"
              onPress={allSelected ? selectNone : selectAll}
              style={styles.selectToggle}
            >
              {allSelected ? 'Clear selection' : 'Select all'}
            </Text>
          </View>
        }
      />

      <View style={styles.footer}>
        <Button
          title={
            stats.numbers > 0
              ? `Update ${formatCount(stats.numbers)} ${stats.numbers === 1 ? 'number' : 'numbers'}`
              : 'Select numbers to update'
          }
          disabled={stats.numbers === 0}
          onPress={() => setSheetOpen(true)}
        />
      </View>

      <MigrationSheet
        visible={sheetOpen}
        analysis={analysis}
        selected={selected}
        onCancel={() => {
          resetMigration();
          setSheetOpen(false);
        }}
        onDone={handleDone}
      />
    </View>
  );
}

// ── shared sub-screens ───────────────────────────────────────────────────────

function LoadingState({
  title,
  body,
  progress,
  indeterminate,
  caption,
}: {
  title: string;
  body?: string;
  progress: number;
  indeterminate: boolean;
  caption: string;
}) {
  return (
    <Screen>
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.brand} />
        <Text variant="heading" center>
          {title}
        </Text>
        {body ? (
          <Text variant="body" tone="secondary" center>
            {body}
          </Text>
        ) : null}
        <View style={styles.progressBlock}>
          <ProgressBar progress={progress} indeterminate={indeterminate} />
          <Text variant="caption" tone="secondary" center>
            {caption}
          </Text>
        </View>
      </View>
    </Screen>
  );
}

function ErrorState({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string | null;
  onRetry: () => void;
}) {
  return (
    <Screen>
      <View style={styles.centered}>
        <Text variant="heading" center>
          {title}
        </Text>
        <Text variant="body" tone="secondary" center>
          {message ?? 'Something went wrong.'}
        </Text>
        <Button title="Try again" onPress={onRetry} fullWidth={false} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listFlex: {
    flex: 1,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
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
  header: {
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  selectToggle: {
    paddingTop: spacing.sm,
  },
  link: {
    textDecorationLine: 'underline',
  },
  gap: {
    height: spacing.md,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
