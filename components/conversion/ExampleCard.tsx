import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { convertNumber } from '@/services/numbering';
import { OperatorLogo } from './OperatorLogo';

const EXAMPLE_OLD = '7012345';
const outcome = convertNumber(EXAMPLE_OLD);
const EXAMPLE_NEW = outcome.status === 'convertible' ? outcome.display : '877012345';
const EXAMPLE_OPERATOR = outcome.status === 'convertible' ? outcome.operatorName : 'Africell';
const EXAMPLE_OPERATOR_ID = outcome.status === 'convertible' ? outcome.operator : 'africell';
const PREFIX = EXAMPLE_NEW.slice(0, 2);

/**
 * Home-screen teaser: a real before/after run through the numbering engine, so
 * it can never drift from the actual conversion rules.
 */
export function ExampleCard() {
  return (
    <View style={styles.card}>
      <Text variant="label" tone="secondary" style={styles.eyebrow}>
        EXAMPLE
      </Text>

      <View style={styles.row}>
        <Text variant="caption" tone="secondary" style={styles.rowLabel}>
          Old
        </Text>
        <Text style={styles.oldNumber}>{EXAMPLE_OLD}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.row}>
        <Text variant="caption" tone="secondary" style={styles.rowLabel}>
          New
        </Text>
        <Text style={styles.newNumber}>
          <Text style={styles.newPrefix}>{PREFIX}</Text>
          {EXAMPLE_NEW.slice(2)}
        </Text>
        <View style={styles.operatorTag}>
          <OperatorLogo operator={EXAMPLE_OPERATOR_ID} name={EXAMPLE_OPERATOR} size={18} />
          <Text variant="caption" tone="secondary">
            {EXAMPLE_OPERATOR}
          </Text>
        </View>
      </View>

      <Text variant="caption" tone="secondary">
        Same number — {EXAMPLE_OPERATOR}’s code ({PREFIX}) goes in front, with no space.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowLabel: {
    width: 34,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  oldNumber: {
    fontSize: 19,
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
    fontVariant: ['tabular-nums'],
  },
  newNumber: {
    flex: 1,
    fontSize: 21,
    fontWeight: '800',
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  operatorTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  // the added operator code, tinted so the new part stands out with no gap
  newPrefix: {
    color: colors.textSecondary,
  },
});
