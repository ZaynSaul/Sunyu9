import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { colors, radius } from '@/constants/theme';

interface CheckboxProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Accessible label describing what is being toggled. */
  label: string;
  /** Render as a partial / mixed state (some children selected). */
  indeterminate?: boolean;
  disabled?: boolean;
}

export function Checkbox({ checked, onChange, label, indeterminate = false, disabled }: CheckboxProps) {
  const active = checked || indeterminate;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: indeterminate ? 'mixed' : checked, disabled: !!disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={8}
      onPress={() => onChange(!checked)}
      style={[styles.box, active && styles.boxActive, disabled && styles.disabled]}
    >
      {active ? (
        <Ionicons
          name={indeterminate ? 'remove' : 'checkmark'}
          size={16}
          color={colors.textInverse}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  boxActive: {
    backgroundColor: colors.accentGreen,
    borderColor: colors.accentGreen,
  },
  disabled: {
    opacity: 0.4,
  },
});
