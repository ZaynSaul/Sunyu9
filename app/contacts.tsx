import { Redirect } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ContactList } from '@/components/contacts/ContactList';
import { Button, ProgressBar, Screen, Text } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { useContactStore } from '@/store/contactStore';
import { formatCount } from '@/utils/format';

/**
 * Read-only "everything we read" list. Not part of the main flow — it's opened
 * from the "See all contacts" link on the review screen so people can confirm
 * nothing is hidden. The review screen does the reading; this just displays it.
 */
export default function ContactsScreen() {
  const permission = useContactStore((s) => s.permission);
  const status = useContactStore((s) => s.status);
  const progress = useContactStore((s) => s.progress);
  const contacts = useContactStore((s) => s.contacts);
  const error = useContactStore((s) => s.error);
  const loadContacts = useContactStore((s) => s.loadContacts);
  const refreshPermission = useContactStore((s) => s.refreshPermission);

  useEffect(() => {
    if (permission === null) void refreshPermission();
  }, [permission, refreshPermission]);

  useEffect(() => {
    if (permission?.canReadContacts && status === 'idle') void loadContacts();
  }, [permission?.canReadContacts, status, loadContacts]);

  if (permission && !permission.canReadContacts) {
    return <Redirect href="/" />;
  }

  if (status === 'idle' || status === 'reading') {
    const { processed, total } = progress;
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.brand} size="large" />
          <Text variant="heading" center>
            Reading your contacts…
          </Text>
          <View style={styles.progressBlock}>
            <ProgressBar progress={total > 0 ? processed / total : 0} indeterminate={total === 0} />
            <Text variant="caption" tone="secondary" center>
              {total > 0 ? `${formatCount(processed)} / ${formatCount(total)}` : 'Getting started…'}
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
      <ContactList
        contacts={contacts}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text variant="body" tone="secondary">
              Every contact on this device that has a phone number. Sunyu9 checked each one — go
              back to the review screen to see and approve the changes.
            </Text>
            {limited ? (
              <Text variant="caption" tone="secondary">
                You granted access to a limited selection of contacts. Only those are shown.
              </Text>
            ) : null}
          </View>
        }
      />
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
});
