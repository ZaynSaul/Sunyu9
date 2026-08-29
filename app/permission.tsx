import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { useContactPermission } from '@/hooks/useContactPermission';

const REASONS = [
  'Find contacts still saved with an old 7-digit number.',
  'Show you a preview of every change before anything is saved.',
  'Update the numbers you approve — and undo them if you change your mind.',
];

export default function PermissionScreen() {
  const { permission, checking, request } = useContactPermission();

  // As soon as we have access, move on to the review flow (it reads + scans).
  useEffect(() => {
    if (permission?.canReadContacts) {
      router.replace('/results');
    }
  }, [permission?.canReadContacts]);

  const blocked = permission?.state === 'blocked';
  const denied = permission?.state === 'denied';

  return (
    <Screen>
      <View style={styles.body}>
        <Text variant="title">Allow access to your contacts</Text>
        <Text variant="body" tone="secondary">
          Sunyu9 needs to read your phonebook to do its job. Here is exactly what it uses the
          access for:
        </Text>

        <View style={styles.reasons}>
          {REASONS.map((reason) => (
            <View key={reason} style={styles.reasonRow}>
              <View style={styles.bullet} />
              <Text variant="body" style={styles.reasonText}>
                {reason}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.privacy}>
          <Text variant="label" tone="success">
            Your contacts never leave your phone
          </Text>
          <Text variant="caption" tone="secondary">
            There is no account and no internet connection. Nothing is uploaded or shared.
          </Text>
        </View>

        {blocked ? (
          <Text variant="caption" tone="danger">
            Access is turned off for Sunyu9. Open Settings to allow contacts, then come back.
          </Text>
        ) : denied ? (
          <Text variant="caption" tone="danger">
            Access was declined. You can try again below.
          </Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        {checking && !permission ? (
          <ActivityIndicator color={colors.brand} />
        ) : (
          <Button
            title={blocked ? 'Open Settings' : 'Allow access'}
            onPress={() => {
              void request();
            }}
          />
        )}
        <Button title="Not now" variant="ghost" onPress={() => router.back()} />
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
  reasons: {
    gap: spacing.md,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  bullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand,
    marginTop: 7,
  },
  reasonText: {
    flex: 1,
  },
  privacy: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  actions: {
    gap: spacing.md,
  },
});
