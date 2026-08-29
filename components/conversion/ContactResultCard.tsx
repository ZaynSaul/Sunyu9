import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Checkbox, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import type { AnalyzedContact } from '@/services/contacts/contactAnalyzer';
import { initialOf } from '@/utils/format';
import { NumberDiffRow } from './NumberDiffRow';

interface ContactResultCardProps {
  analyzed: AnalyzedContact;
  selectedKeys: Set<string>;
  onToggleNumber: (key: string) => void;
  onToggleContact: (contactId: string, selected: boolean) => void;
}

function ContactResultCardComponent({
  analyzed,
  selectedKeys,
  onToggleNumber,
  onToggleContact,
}: ContactResultCardProps) {
  const { contact, numbers } = analyzed;

  const convertibleKeys = useMemo(
    () => numbers.filter((n) => n.convertible).map((n) => n.key),
    [numbers],
  );
  const selectedCount = convertibleKeys.filter((k) => selectedKeys.has(k)).length;
  const allSelected = selectedCount === convertibleKeys.length && selectedCount > 0;
  const someSelected = selectedCount > 0 && !allSelected;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text variant="label" tone="secondary">
            {initialOf(contact.name)}
          </Text>
        </View>
        <Text variant="heading" style={styles.name} numberOfLines={1}>
          {contact.name}
        </Text>
        {convertibleKeys.length > 1 ? (
          <Checkbox
            checked={allSelected}
            indeterminate={someSelected}
            onChange={(next) => onToggleContact(contact.id, next)}
            label={`Select all ${convertibleKeys.length} changes for ${contact.name}`}
          />
        ) : null}
      </View>

      <View style={styles.rows}>
        {numbers.map((number) => (
          <NumberDiffRow
            key={number.key}
            number={number}
            selected={selectedKeys.has(number.key)}
            onToggle={onToggleNumber}
          />
        ))}
      </View>
    </View>
  );
}

export const ContactResultCard = memo(ContactResultCardComponent);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    flex: 1,
  },
  rows: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.xs,
  },
});
