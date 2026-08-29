import { useCallback } from 'react';
import { FlatList, StyleSheet, View, type ListRenderItem } from 'react-native';

import { Text } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import type { AppContact } from '@/types';
import { ContactListItem } from './ContactListItem';

interface ContactListProps {
  contacts: AppContact[];
  ListHeaderComponent?: React.ComponentProps<typeof FlatList>['ListHeaderComponent'];
}

/**
 * Windowed contact list. Tuned for large address books: only a few screens of
 * rows are mounted at a time. If profiling on 2k+ contacts still shows jank,
 * swap `FlatList` for `@shopify/flash-list` — the row component is already memoised.
 */
export function ContactList({ contacts, ListHeaderComponent }: ContactListProps) {
  const renderItem = useCallback<ListRenderItem<AppContact>>(
    ({ item }) => <ContactListItem contact={item} />,
    [],
  );

  const keyExtractor = useCallback((item: AppContact) => item.id, []);

  return (
    <FlatList
      data={contacts}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ListHeaderComponent={ListHeaderComponent}
      ItemSeparatorComponent={Separator}
      ListEmptyComponent={EmptyState}
      contentContainerStyle={contacts.length === 0 ? styles.emptyContainer : styles.container}
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      windowSize={11}
      removeClippedSubviews
      keyboardShouldPersistTaps="handled"
    />
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

function EmptyState() {
  return (
    <View style={styles.empty}>
      <Text variant="heading" center>
        No contacts with phone numbers
      </Text>
      <Text variant="body" tone="secondary" center>
        Contacts without a phone number are skipped — there is nothing here to update.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: spacing.xxl + spacing.md,
  },
  empty: {
    gap: spacing.sm,
    alignItems: 'center',
  },
});
