import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { Checkbox, Text } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import type { AnalyzedPhoneNumber } from '@/services/contacts/contactAnalyzer';
import { formatLabel } from '@/utils/format';
import { outcomeLabel } from '@/utils/conversionLabels';

interface NumberDiffRowProps {
  number: AnalyzedPhoneNumber;
  selected: boolean;
  onToggle: (key: string) => void;
}

export function NumberDiffRow({ number, selected, onToggle }: NumberDiffRowProps) {
  const { phone, outcome } = number;
  const label = formatLabel(phone.label);

  if (outcome.status === 'convertible') {
    return (
      <View style={styles.row}>
        <Checkbox
          checked={selected}
          onChange={() => onToggle(number.key)}
          label={`Update ${label} number ${phone.original} to ${outcome.display}`}
        />
        <View style={styles.body}>
          <Text variant="caption" tone="secondary">
            {label}
          </Text>
          <View style={styles.diff}>
            <Text variant="body" tone="secondary" style={styles.oldNumber}>
              {phone.original}
            </Text>
            <Ionicons name="arrow-forward" size={15} color={colors.textSecondary} />
            <Text variant="body" weight="semibold">
              {outcome.display}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // Non-convertible: shown greyed so the user can see nothing is hidden.
  return (
    <View style={[styles.row, styles.mutedRow]}>
      <View style={styles.spacer} />
      <View style={styles.body}>
        <Text variant="caption" tone="secondary">
          {label}
        </Text>
        <Text variant="body" tone="secondary">
          {phone.original}
        </Text>
        <Text variant="caption" tone="secondary">
          {outcomeLabel(outcome)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  mutedRow: {
    opacity: 0.6,
  },
  spacer: {
    width: 24,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  diff: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  oldNumber: {
    textDecorationLine: 'line-through',
  },
});
