import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { Button } from './Button';
import { Screen } from './Screen';
import { Text } from './Text';

interface ComingSoonProps {
  title: string;
  description: string;
}

/** Placeholder for routes that exist for navigation structure but aren't built yet. */
export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <Screen>
      <View style={styles.body}>
        <Text variant="title" center>
          {title}
        </Text>
        <Text variant="body" tone="secondary" center>
          {description}
        </Text>
      </View>
      <Button title="Back" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
});
