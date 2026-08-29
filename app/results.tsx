import { Redirect, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View, type ListRenderItem } from 'react-native';

import { ConfirmMigrationSheet } from '@/components/conversion/ConfirmMigrationSheet';
import { ContactResultCard } from '@/components/conversion/ContactResultCard';
import { Button, Screen, Text } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import type { AnalyzedContact } from '@/services/contacts/contactAnalyzer';
import { selectionStats, useAnalysisStore } from '@/store/analysisStore';
import { formatCount } from '@/utils/format';

export default function ResultsScreen() {
  const status = useAnalysisStore((s) => s.status);
  const analysis = useAnalysisStore((s) => s.analysis);
  const selected = useAnalysisStore((s) => s.selected);
  const toggleNumber = useAnalysisStore((s) => s.toggleNumber);
  const setContactSelected = useAnalysisStore((s) => s.setContactSelected);
  const selectAll = useAnalysisStore((s) => s.selectAll);
  const selectNone = useAnalysisStore((s) => s.selectNone);

  const [confirming, setConfirming] = useState(false);

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

  if (status !== 'ready' || !analysis) {
    return <Redirect href="/scan" />;
  }

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
          <Button
            title="Done"
            onPress={() => {
              if (router.canDismiss()) router.dismissAll();
              router.replace('/');
            }}
          />
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
          onPress={() => setConfirming(true)}
        />
      </View>

      <ConfirmMigrationSheet
        visible={confirming}
        numbers={stats.numbers}
        contacts={stats.contacts}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          router.push('/updating');
        }}
      />
    </View>
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
