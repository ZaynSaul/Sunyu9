import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { Pressable } from 'react-native';

import { colors } from '@/constants/theme';

/**
 * Persistent header entry to Settings / privacy info. Rendered as `headerRight`
 * on every screen that has a header, so the privacy details and Undo stay one
 * tap away from anywhere in the flow. Hides itself on the Settings screen.
 */
export function HeaderSettingsButton() {
  const pathname = usePathname();
  if (pathname === '/settings') return null;

  return (
    <Pressable
      onPress={() => router.push('/settings')}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Settings and privacy"
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingHorizontal: 4 })}
    >
      <Ionicons name="shield-checkmark-outline" size={22} color={colors.textPrimary} />
    </Pressable>
  );
}
