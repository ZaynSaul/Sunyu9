import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import type { AppContact } from '@/types';
import { formatLabel, initialOf } from '@/utils/format';

interface ContactListItemProps {
  contact: AppContact;
}

function ContactListItemComponent({ contact }: ContactListItemProps) {
  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Text variant="label" tone="secondary">
          {initialOf(contact.name)}
        </Text>
      </View>

      <View style={styles.details}>
        <Text variant="heading" numberOfLines={1}>
          {contact.name}
        </Text>
        {contact.phoneNumbers.map((phone, index) => (
          <View key={phone.id ?? `${contact.id}:${index}`} style={styles.phoneRow}>
            <Text variant="caption" tone="secondary" style={styles.phoneLabel}>
              {formatLabel(phone.label)}
            </Text>
            <Text variant="body" style={styles.phoneNumber}>
              {phone.original}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export const ContactListItem = memo(ContactListItemComponent);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  details: {
    flex: 1,
    gap: spacing.xs,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  phoneLabel: {
    width: 64,
  },
  phoneNumber: {
    flex: 1,
  },
});
