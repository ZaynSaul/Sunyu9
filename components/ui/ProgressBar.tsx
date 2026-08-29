import { StyleSheet, View } from 'react-native';

import { colors, radius } from '@/constants/theme';

interface ProgressBarProps {
  /** 0–1. Values outside the range are clamped. */
  progress: number;
  /** Show an indeterminate full-width track when total is unknown. */
  indeterminate?: boolean;
}

export function ProgressBar({ progress, indeterminate = false }: ProgressBarProps) {
  const pct = indeterminate ? 1 : Math.max(0, Math.min(1, progress));

  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityValue={indeterminate ? undefined : { min: 0, max: 100, now: Math.round(pct * 100) }}
    >
      <View style={[styles.fill, { width: `${pct * 100}%` }, indeterminate && styles.indeterminate]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  indeterminate: {
    opacity: 0.4,
  },
});
