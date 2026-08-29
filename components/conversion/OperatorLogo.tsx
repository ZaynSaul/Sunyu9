import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/components/ui';
import { colors, radius } from '@/constants/theme';
import type { OperatorId } from '@/constants/numbering';

/**
 * A neutral operator mark: a monogram chip in the grey scale. We deliberately
 * don't render the networks' brand logos — the app's whole look is one calm
 * accent on greyscale, and coloured third-party art fights that. The 2-digit
 * network code shown next to it is the real identifier anyway.
 */
interface OperatorLogoProps {
  operator: OperatorId;
  /** Operator display name — drives the accessibility label and the letter. */
  name?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function OperatorLogo({ operator, name, size = 24, style }: OperatorLogoProps) {
  const letter = (name ?? operator).charAt(0).toUpperCase();

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${name ?? operator} network`}
      style={[styles.chip, { width: size, height: size, borderRadius: radius.sm }, style]}
    >
      <Text variant="label" tone="secondary" style={{ fontSize: size * 0.42 }}>
        {letter}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
