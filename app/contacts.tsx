import { Redirect, Stack, router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ContactList } from '@/components/contacts/ContactList';
import { Button, ProgressBar, Screen, Text } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { useAnalysisStore } from '@/store/analysisStore';
import { useContactStore } from '@/store/contactStore';
import { formatCount } from '@/utils/format';

export default function ContactsScreen() {
  const permission = useContactStore((s) => s.permission);
  const status = useContactStore((s) => s.status);
  const progress = useContactStore((s) => s.progress);
  const contacts = useContactStore((s) => s.contacts);
  const error = useContactStore((s) => s.error);
  const loadContacts = useContactStore((s) => s.loadContacts);
  const refreshPermission = useContactStore((s) => s.refreshPermission);
  const resetAnalysis = useAnalysisStore((s) => s.reset);
  const analysisStatus = useAnalysisStore((s) => s.status);

  // First pass through the flow: as soon as contacts are in memory, go straight
  // to the scan. Coming back here deliberately (from Results) leaves the
  // analysis `ready`, so we don't hijack that — the list just shows.
  const advanced = useRef(false);
  useEffect(() => {
    if (status === 'ready' && analysisStatus === 'idle' && !advanced.current) {
      advanced.current = true;
      router.replace('/scan');
    }
  }, [status, analysisStatus]);

  // Make sure we know the permission state even when this screen is the entry
  // point (deep link, or the app was restarted here).
  useEffect(() => {
    if (permission === null) {
      void refreshPermission();
    }
  }, [permission, refreshPermission]);

  // Read once when we arrive with permission and nothing loaded yet.
  useEffect(() => {
    if (permission?.canReadContacts && status === 'idle') {
      void loadContacts();
    }
  }, [permission?.canReadContacts, status, loadContacts]);

  if (permission && !permission.canReadContacts) {
    return <Redirect href="/permission" />;
  }

  // `ready` + analysis `idle` means the auto-advance effect is about to fire —
  // keep the spinner up instead of flashing the full list for a frame.
  const autoAdvancing = status === 'ready' && analysisStatus === 'idle';

  if (status === 'reading' || status === 'idle' || autoAdvancing) {
    const { processed, total } = progress;
    const ratio = total > 0 ? processed / total : 0;
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.brand} size="large" />
          <Text variant="heading" center>
            Reading your contacts…
          </Text>
          <View style={styles.progressBlock}>
            <ProgressBar progress={ratio} indeterminate={total === 0} />
            <Text variant="caption" tone="secondary" center>
              {total > 0
                ? `${formatCount(processed)} / ${formatCount(total)}`
                : 'Getting started…'}
            </Text>
          </View>
        </View>
      </Screen>
    );
  }

  if (status === 'error') {
    return (
      <Screen>
        <View style={styles.centered}>
          <Text variant="heading" center>
            Could not read your contacts
          </Text>
          <Text variant="body" tone="secondary" center>
            {error ?? 'Something went wrong.'}
          </Text>
          <Button title="Try again" onPress={() => void loadContacts()} fullWidth={false} />
        </View>
      </Screen>
    );
  }

  const limited = permission?.state === 'limited';

  return (
    <View style={styles.fill}>
      <Stack.Screen options={{ title: `${formatCount(contacts.length)} contacts` }} />
      <ContactList
        contacts={contacts}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text variant="body" tone="secondary">
              These are the contacts on this device that have a phone number. Next, Sunyu9 will
              check each number against the new 9-digit plan.
            </Text>
            {limited ? (
              <Text variant="caption" tone="secondary">
                You granted access to a limited selection of contacts. Only those are shown.
              </Text>
            ) : null}
          </View>
        }
      />
      <View style={styles.footer}>
        {analysisStatus === 'ready' ? (
          <Button title="See the changes" onPress={() => router.push('/results')} />
        ) : (
          <Button
            title="Check for old numbers"
            onPress={() => {
              resetAnalysis();
              router.push('/scan');
            }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: colors.background,
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
  listHeader: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
