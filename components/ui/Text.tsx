import { Text as RNText, StyleSheet, type TextProps as RNTextProps } from 'react-native';

import { colors, fontSize, fontWeight } from '@/constants/theme';

type Variant = 'display' | 'title' | 'heading' | 'subtitle' | 'body' | 'label' | 'caption';
type Tone = 'primary' | 'secondary' | 'inverse' | 'brand' | 'danger' | 'success';

export interface TextProps extends RNTextProps {
  variant?: Variant;
  tone?: Tone;
  weight?: keyof typeof fontWeight;
  center?: boolean;
}

const toneColor: Record<Tone, string> = {
  primary: colors.textPrimary,
  secondary: colors.textSecondary,
  inverse: colors.textInverse,
  brand: colors.brand,
  danger: colors.danger,
  // "success" keeps its name for intent, but positive text is just near-black —
  // green is reserved for icons (the checkbox tick, assurance checks).
  success: colors.textPrimary,
};

export function Text({
  variant = 'body',
  tone = 'primary',
  weight,
  center = false,
  style,
  ...rest
}: TextProps) {
  return (
    <RNText
      style={[
        styles[variant],
        { color: toneColor[tone] },
        weight ? { fontWeight: fontWeight[weight] } : null,
        center ? styles.center : null,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  display: { fontSize: fontSize.display, fontWeight: fontWeight.bold, lineHeight: fontSize.display * 1.15 },
  title: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, lineHeight: fontSize.xxl * 1.2 },
  heading: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, lineHeight: fontSize.lg * 1.3 },
  subtitle: { fontSize: fontSize.xl, fontWeight: fontWeight.semibold, lineHeight: fontSize.xl * 1.25 },
  body: { fontSize: fontSize.md, fontWeight: fontWeight.regular, lineHeight: fontSize.md * 1.45 },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, lineHeight: fontSize.sm * 1.3 },
  caption: { fontSize: fontSize.xs, fontWeight: fontWeight.regular, lineHeight: fontSize.xs * 1.4 },
  center: { textAlign: 'center' },
});
