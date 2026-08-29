import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { HeaderSettingsButton } from '@/components/ui';
import { colors, fontWeight } from '@/constants/theme';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
          <Stack.Screen name="permission" options={{ title: 'Contact access' }} />
          <Stack.Screen name="results" options={{ title: 'Review changes' }} />
          <Stack.Screen name="contacts" options={{ title: 'All contacts' }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
