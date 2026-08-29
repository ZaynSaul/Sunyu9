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
}

const DEFAULT_EDGES: readonly Edge[] = ['top', 'bottom'];

export function Screen({ children, scroll = false, edges = DEFAULT_EDGES, contentStyle }: ScreenProps) {
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
});
