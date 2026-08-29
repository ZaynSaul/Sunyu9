import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { DeadlineCard } from '@/components/DeadlineCard';
import { ExampleCard } from '@/components/conversion/ExampleCard';
import { PermissionSheet } from '@/components/permission/PermissionSheet';
import { Button, Screen, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { useContactPermission } from '@/hooks/useContactPermission';

const logo = require('../assets/icon.png');

export default function HomeScreen() {
  const { permission } = useContactPermission();
  const [permissionOpen, setPermissionOpen] = useState(false);

  const startScan = useCallback(() => {
    if (permission?.canReadContacts) {
      router.push('/results');
    } else {
      setPermissionOpen(true);
    }
  }, [permission?.canReadContacts]);

  return (
    <Screen
      scroll
      footer={
        <>
          <Button title="Scan my contacts" onPress={startScan} />
          <Link href="/settings" asChild>
            <Button title="How it works & privacy" variant="ghost" />
          </Link>
        </>
      }
    >
      <View style={styles.body}>
        <View style={styles.hero}>
          <Image source={logo} style={styles.logo} resizeMode="contain" accessible={false} />
          <Text variant="display">Sunyu9</Text>
          <Text variant="body" tone="secondary">
            The Gambia is switching mobile numbers from 7 digits to 9. Sunyu9 updates the old
            numbers in your contacts — in bulk, with a preview and an undo.
          </Text>
        </View>

        <DeadlineCard />

        <ExampleCard />

        <View style={styles.privacy}>
          <Ionicons
            name="shield-checkmark"
            size={20}
            color={colors.brand}
            style={styles.privacyIcon}
          />
          <View style={styles.privacyText}>
            <Text variant="label">Your contacts never leave your phone</Text>
            <Text variant="caption" tone="secondary">
              Everything runs on this device. No account, no internet, no uploads.
            </Text>
          </View>
        </View>
      </View>

      <PermissionSheet
        visible={permissionOpen}
        onClose={() => setPermissionOpen(false)}
        onGranted={() => {
          setPermissionOpen(false);
          router.push('/results');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    gap: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  hero: {
    gap: spacing.sm,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
  },
  privacy: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  privacyIcon: {
    marginTop: 1,
  },
  privacyText: {
    flex: 1,
    gap: 2,
  },
});
