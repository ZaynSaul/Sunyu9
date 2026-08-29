import { Ionicons } from '@expo/vector-icons';
import { type ReactNode, useEffect, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '@/constants/theme';

const SCREEN_H = Dimensions.get('window').height;

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /**
   * When `false`, the backdrop tap, the Android back button and the close (×)
   * button all do nothing — the content must provide its own way out. Used
   * while a migration is writing so the run can't be half-abandoned.
   * Default `true`.
   */
  dismissible?: boolean;
}

/**
 * Lightweight bottom sheet — slides up over a dimmed backdrop, sized to its
 * content. Dismisses on the close (×) button, backdrop tap, the Android back
 * button, or whatever control the content provides (unless `dismissible={false}`).
 *
 * Deliberately built on RN's own `Animated` + `Modal` (no reanimated /
 * gesture-handler) to keep this offline utility's dependency surface and APK
 * small. Same visual language as the sheet in the Deliva app.
 */
export function BottomSheet({ visible, onClose, children, dismissible = true }: BottomSheetProps) {
  const requestClose = dismissible ? onClose : () => {};
  const insets = useSafeAreaInsets();

  // Animated values are created once and never reassigned — `useState`'s lazy
  // initialiser keeps them stable without the ref-during-render lint noise.
  const [translateY] = useState(() => new Animated.Value(SCREEN_H));
  const [backdrop] = useState(() => new Animated.Value(0));

  // Keep the Modal mounted through the exit animation. Adjusting state during
  // render (rather than in an effect) is the React-blessed way to respond to a
  // prop change without an extra paint.
  const [rendered, setRendered] = useState(visible);
  if (visible && !rendered) {
    setRendered(true);
  }

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 240,
          mass: 0.7,
        }),
        Animated.timing(backdrop, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
      return;
    }

    const exit = Animated.parallel([
      Animated.timing(translateY, {
        toValue: SCREEN_H,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdrop, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]);
    exit.start(({ finished }) => {
      if (finished) setRendered(false);
    });
    return () => exit.stop();
  }, [visible, translateY, backdrop]);

  if (!rendered) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={requestClose} statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
          {dismissible ? (
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
            />
          ) : null}
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + spacing.lg, transform: [{ translateY }] },
          ]}
        >
          <View style={styles.grabber}>
            <View style={styles.handle} />
            {dismissible ? (
              <Pressable
                onPress={onClose}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
              >
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            ) : null}
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(8, 20, 89, 0.45)',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  grabber: {
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  close: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingLeft: spacing.md,
  },
  closePressed: {
    opacity: 0.5,
  },
});
