import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { Image, StyleSheet, View } from 'react-native';

import { ExampleCard } from '@/components/conversion/ExampleCard';
import { Button, Screen, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { getDeadline } from '@/utils/deadline';

const logo = require('../assets/icon.png');

export default function HomeScreen() {
  const deadline = getDeadline();

  return (
    <Screen scroll>
      <View style={styles.body}>
        <View style={styles.hero}>
          <Image source={logo} style={styles.logo} resizeMode="contain" accessible={false} />
          <Text variant="display">Sunyu9</Text>
          <Text variant="body" tone="secondary">
            The Gambia is switching mobile numbers from 7 digits to 9. Sunyu9 updates the old
            numbers in your contacts — in bulk, with a preview and an undo.
          </Text>
        </View>

        <View style={styles.deadline}>
          <Ionicons name="hourglass-outline" size={16} color={colors.textSecondary} />
          <Text variant="caption" style={styles.deadlineText}>
            <Text variant="caption" weight="bold" tone="primary">
              {deadline.headline}
            </Text>{' '}
            {deadline.phase === 'before-dual-run'
              ? 'until 9-digit numbers switch on'
              : deadline.phase === 'dual-run'
                ? `to update — 7-digit numbers stop ${deadline.cutoffLabel}`
                : '— only 9-digit numbers connect now'}
          </Text>
        </View>

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

      <View style={styles.actions}>
        <Button title="Scan my contacts" onPress={() => router.push('/permission')} />
        <Link href="/settings" asChild>
          <Button title="How it works & privacy" variant="ghost" />
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.xl,
    paddingVertical: spacing.lg,
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
  deadline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.brandTint,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  deadlineText: {
    flex: 1,
    lineHeight: 18,
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
  actions: {
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
});
