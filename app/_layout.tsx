import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { HeaderSettingsButton } from '@/components/ui';
import { colors, fontWeight } from '@/constants/theme';

// Hold the native splash until React has laid out the first screen, so the app
// never flashes a blank white frame between the splash and the home screen.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const onLayout = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayout}>
      <SafeAreaProvider>
        <StatusBar style="dark" animated />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.textPrimary,
            headerTitleStyle: { fontWeight: fontWeight.semibold, color: colors.textPrimary },
            headerShadowVisible: false,
            headerBackTitle: 'Back',
            headerRight: () => <HeaderSettingsButton />,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="results" options={{ title: 'Review changes' }} />
          <Stack.Screen name="contacts" options={{ title: 'All contacts' }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
