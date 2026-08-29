import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors, spacing } from '@/constants/theme';

interface ScreenProps {
  children: ReactNode;
  /** Wrap content in a vertical ScrollView. Default `false`. */
  scroll?: boolean;
  /** Safe-area edges to inset. Default top + bottom. */
  edges?: readonly Edge[];
  /** Extra style for the content container. */
  contentStyle?: ViewStyle;
  /**
   * Pinned below the scroll area, inside the safe area — a floating action
   * footer with a hairline top border. Content scrolls behind it.
   */
  footer?: ReactNode;
}

const DEFAULT_EDGES: readonly Edge[] = ['top', 'bottom'];

export function Screen({
  children,
  scroll = false,
  edges = DEFAULT_EDGES,
  contentStyle,
  footer,
}: ScreenProps) {
  const inner = <View style={[styles.content, contentStyle]}>{children}</View>;

  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
