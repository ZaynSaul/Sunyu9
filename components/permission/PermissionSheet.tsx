import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { BottomSheet, Button, Text } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { useContactPermission } from '@/hooks/useContactPermission';

const REASONS = [
  'Find contacts still saved with an old 7-digit number.',
  'Show you a preview of every change before anything is saved.',
  'Update the numbers you approve — and undo them if you change your mind.',
];

interface PermissionSheetProps {
  visible: boolean;
  /** Backdrop tap, Android back, or "Not now". */
  onClose: () => void;
  /** Access is granted (or limited) — safe to continue into the flow. */
  onGranted: () => void;
}

/**
 * Contact-permission ask as a bottom sheet over the home screen, so granting
 * access never costs a screen push. Mirrors the copy of the old `/permission`
 * route it replaces.
 */
export function PermissionSheet({ visible, onClose, onGranted }: PermissionSheetProps) {
  const { permission, checking, request } = useContactPermission();
  const granted = permission?.canReadContacts ?? false;

  // Fire `onGranted` exactly once per time the sheet is opened. Without the latch
  // a later re-render (a new `onGranted` identity, or the AppState refresh that
  // fires when the OS permission dialog closes) would call it again and push the
  // results screen twice.
  const firedRef = useRef(false);
  useEffect(() => {
    if (!visible) {
      firedRef.current = false;
      return;
    }
    if (granted && !firedRef.current) {
      firedRef.current = true;
      onGranted();
    }
  }, [visible, granted, onGranted]);

  const blocked = permission?.state === 'blocked';
  const denied = permission?.state === 'denied';

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text variant="title">Allow access to your contacts</Text>
      <Text variant="body" tone="secondary" style={styles.lede}>
        Sunyu9 needs to read your phonebook to do its job. Here is exactly what it uses the access
        for:
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
        <Text variant="label">Your contacts never leave your phone</Text>
        <Text variant="caption" tone="secondary">
          There is no account and no internet connection. Nothing is uploaded or shared.
        </Text>
      </View>

      {blocked ? (
        <Text variant="caption" tone="danger" style={styles.note}>
          Access is turned off for Sunyu9. Open Settings to allow contacts, then come back.
        </Text>
      ) : denied ? (
        <Text variant="caption" tone="danger" style={styles.note}>
          Access was declined. You can try again below.
        </Text>
      ) : null}

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
        <Button title="Not now" variant="ghost" onPress={onClose} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  lede: {
    marginTop: spacing.xs,
  },
  reasons: {
    gap: spacing.md,
    marginTop: spacing.lg,
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
    marginTop: spacing.lg,
  },
  note: {
    marginTop: spacing.md,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
});
