import { Redirect, router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, BackHandler, StyleSheet, View } from 'react-native';

import { Button, ProgressBar, Screen, Text } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { selectionStats, useAnalysisStore } from '@/store/analysisStore';
import { useMigrationStore } from '@/store/migrationStore';
import { formatCount } from '@/utils/format';

export default function UpdatingScreen() {
  const analysis = useAnalysisStore((s) => s.analysis);
  const selected = useAnalysisStore((s) => s.selected);

  const apply = useMigrationStore((s) => s.apply);
  const applyStatus = useMigrationStore((s) => s.applyStatus);
  const progress = useMigrationStore((s) => s.progress);
  const error = useMigrationStore((s) => s.error);

  const stats = selectionStats(analysis, selected);

  useEffect(() => {
    if (analysis && stats.numbers > 0 && applyStatus === 'idle') {
      void apply(analysis, selected);
    }
  }, [analysis, stats.numbers, applyStatus, apply, selected]);

  useEffect(() => {
    if (applyStatus === 'done') {
      router.replace('/success');
    }
  }, [applyStatus]);

  // Block hardware back while writing so a run is never half-abandoned silently.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => applyStatus === 'applying');
    return () => sub.remove();
  }, [applyStatus]);

  if (!analysis || (stats.numbers === 0 && applyStatus === 'idle')) {
    return <Redirect href="/results" />;
  }

  if (applyStatus === 'error') {
    return (
      <Screen>
        <View style={styles.centered}>
          <Text variant="heading" center tone="danger">
            The update stopped
          </Text>
          <Text variant="body" tone="secondary" center>
            {error ?? 'Something went wrong.'} Any changes already made are backed up and can be
            undone.
          </Text>
          <Button title="Try again" onPress={() => void apply(analysis, selected)} />
          <Button title="Back to review" variant="ghost" onPress={() => router.replace('/results')} />
        </View>
      </Screen>
    );
  }

  const { done, total } = progress;
  const ratio = total > 0 ? done / total : 0;

  return (
    <Screen>
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.brand} />
        <Text variant="heading" center>
          Updating contacts…
        </Text>
        <Text variant="body" tone="secondary" center>
          Please keep the app open. The original numbers are being backed up as we go.
        </Text>
        <View style={styles.progressBlock}>
          <ProgressBar progress={ratio} indeterminate={total === 0} />
          <Text variant="caption" tone="secondary" center>
            {total > 0 ? `${formatCount(done)} / ${formatCount(total)}` : 'Starting…'}
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
});
