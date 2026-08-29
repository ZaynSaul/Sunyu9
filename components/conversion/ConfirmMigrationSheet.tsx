import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { BottomSheet, Button, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { formatCount } from '@/utils/format';

const ASSURANCES = [
  'The original numbers are backed up on this device first.',
  'Only the numbers you selected are changed.',
  'You can undo straight after, restoring every original number.',
  'Nothing is uploaded — this all happens on your phone.',
];

interface ConfirmMigrationSheetProps {
  visible: boolean;
  numbers: number;
  contacts: number;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Final "are you sure" step, shown as a bottom sheet from the review screen so
 * confirming doesn't cost a screen push. Writing still happens on the dedicated
 * `updating` screen (which blocks navigation while it runs).
 */
export function ConfirmMigrationSheet({
  visible,
  numbers,
  contacts,
  onConfirm,
  onCancel,
}: ConfirmMigrationSheetProps) {
  const noun = numbers === 1 ? 'number' : 'numbers';

  return (
    <BottomSheet visible={visible} onClose={onCancel}>
      <Text variant="title">
        Update {formatCount(numbers)} {noun}?
      </Text>
      <Text variant="body" tone="secondary" style={styles.lede}>
        This changes {formatCount(numbers)} {noun} across {formatCount(contacts)}{' '}
        {contacts === 1 ? 'contact' : 'contacts'} to the new 9-digit format.
      </Text>

      <View style={styles.card}>
        {ASSURANCES.map((line) => (
          <View key={line} style={styles.assuranceRow}>
            <Ionicons
              name="checkmark-circle"
              size={20}
              color={colors.accentGreen}
              style={styles.assuranceIcon}
            />
            <Text variant="body" style={styles.assuranceText}>
              {line}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <Button title={`Update ${formatCount(numbers)} ${noun}`} onPress={onConfirm} />
        <Button title="Cancel" variant="ghost" onPress={onCancel} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  lede: {
    marginTop: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  assuranceRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  assuranceIcon: {
    marginTop: 1,
  },
  assuranceText: {
    flex: 1,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
});
