import { Redirect, router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button, ProgressBar, Screen, Text } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { useAnalysisStore } from '@/store/analysisStore';
import { useContactStore } from '@/store/contactStore';
import { formatCount } from '@/utils/format';

export default function ScanScreen() {
  const contacts = useContactStore((s) => s.contacts);
  const contactStatus = useContactStore((s) => s.status);

  const analyze = useAnalysisStore((s) => s.analyze);
  const status = useAnalysisStore((s) => s.status);
  const progress = useAnalysisStore((s) => s.progress);
  const error = useAnalysisStore((s) => s.error);

  useEffect(() => {
    if (contactStatus === 'ready' && status === 'idle') {
      void analyze(contacts);
    }
  }, [contactStatus, status, contacts, analyze]);

  useEffect(() => {
    if (status === 'ready') {
      router.replace('/results');
    }
  }, [status]);

  // Contacts must be read before we can scan them.
  if (contactStatus === 'idle' || contactStatus === 'error') {
    return <Redirect href="/contacts" />;
  }

  if (status === 'error') {
    return (
      <Screen>
        <View style={styles.centered}>
          <Text variant="heading" center>
            Could not check your numbers
          </Text>
          <Text variant="body" tone="secondary" center>
            {error ?? 'Something went wrong.'}
          </Text>
          <Button title="Try again" fullWidth={false} onPress={() => void analyze(contacts)} />
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
          Checking your numbers…
        </Text>
        <Text variant="body" tone="secondary" center>
          Every number is checked against the official 9-digit plan. Nothing is changed yet.
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
