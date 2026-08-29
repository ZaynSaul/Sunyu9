/**
 * Design tokens for Sunyu9.
 *
 * One calm accent, a strong neutral scale, and status colours (red / green)
 * reserved strictly for errors and success. Blue = identity + primary action +
 * links; everything else is greyscale. White is the dominant colour.
 */

export const colors = {
  // Accent — the only brand colour, used sparingly
  brand: '#1D4ED8',
  brandDark: '#1D4ED8', // pressed / active
  brandTint: '#DBEAFE', // selected rows, info callouts

  // Status — icons and small accents only, never large fills or body text
  accentGreen: '#16A34A',
  accentGreenTint: '#DCFCE7',
  danger: '#DC2626',
  dangerTint: '#FEF2F2',

  // Neutrals — ~90% of the UI
  background: '#FFFFFF',
  surface: '#F9FAFB',
  surfaceAlt: '#F3F4F6',
  border: '#E5E7EB',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textInverse: '#FFFFFF',
  textDisabled: '#9CA3AF',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  display: 34,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const theme = { colors, spacing, radius, fontSize, fontWeight } as const;
export type Theme = typeof theme;
