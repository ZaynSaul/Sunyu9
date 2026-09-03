import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { DeadlineCard } from '@/components/DeadlineCard';
import { LastMigrationCard } from '@/components/conversion/LastMigrationCard';
import { OperatorLogo } from '@/components/conversion/OperatorLogo';
import { Screen, Text } from '@/components/ui';
import { SOURCE_URL } from '@/constants/app';
import {
  NUMBERING_LAST_VERIFIED,
  NUMBERING_SOURCES,
  NUMBERING_VERIFICATION,
  OPERATOR_RULES,
  type OperatorRule,
} from '@/constants/numbering';
import { PRIVACY_VERIFICATION } from '@/constants/privacy';
import { colors, radius, spacing } from '@/constants/theme';
import { formatPlanDate } from '@/utils/deadline';

/* ----------------------------------------------------------------- helpers */

/** Recover the leading digits a rule matches, straight from its own matcher. */
function leadingDigitsOf(rule: OperatorRule): string {
  const digits: string[] = [];
  for (let i = 0; i <= 9; i += 1) {
    if (rule.matches(`${i}000000`)) digits.push(String(i));
  }
  return digits.join(', ');
}

const SOURCE_SHORT: Record<string, string> = {
  'https://pura.gm/ict/scarce-resource-management/numbering-resource-management/':
    'PURA — official numbering plan',
  'https://pura.gm/public-notice-migration-of-the-national-mobile-numbering-plan-from-7-digit-to-9-digit-format/':
    'PURA — 9-digit migration notice',
  'https://thepoint.gm/africa/gambia/headlines/gambia-set-to-move-phone-numbers-from-7-to-nine-digit-system':
    'The Point — news coverage',
  'https://en.wikipedia.org/wiki/Telephone_numbers_in_the_Gambia':
    'Wikipedia — Gambia phone numbers',
};

const PRIVACY_POINTS = [
  'Works completely offline',
  'No account, no sign-up, no tracking',
  'Contacts never leave this phone',
  'Originals backed up before any change',
  'Undo any update, any time',
];

/* -------------------------------------------------------------- UI pieces */

/** A titled group of rows, iOS-settings style. */
function Group({
  title,
  icon,
  footnote,
  children,
}: {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  footnote?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.group}>
      <View style={styles.groupHeader}>
        <Ionicons name={icon} size={14} color={colors.textSecondary} />
        <Text variant="label" tone="secondary" style={styles.groupTitle}>
          {title.toUpperCase()}
        </Text>
      </View>
      <View style={styles.groupCard}>{children}</View>
      {footnote ? (
        <Text variant="caption" tone="secondary" style={styles.groupFootnote}>
          {footnote}
        </Text>
      ) : null}
    </View>
  );
}

/** One hairline-separated row. `first` drops the top border. */
function Row({
  first,
  onPress,
  children,
}: {
  first?: boolean;
  onPress?: () => void;
  children: React.ReactNode;
}) {
  const body = <View style={[styles.row, !first && styles.rowDivider]}>{children}</View>;
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.rowPressed}>
      {body}
    </Pressable>
  );
}

function OperatorRow({ rule, first }: { rule: OperatorRule; first?: boolean }) {
  return (
    <Row first={first}>
      <OperatorLogo operator={rule.id} name={rule.name} size={38} style={styles.opLogo} />
      <View style={styles.rowText}>
        <Text variant="body" weight="semibold">
          {rule.name}
        </Text>
        <Text variant="caption" tone="secondary">
          Starts with {leadingDigitsOf(rule)}
        </Text>
      </View>
      {rule.migrating ? (
        <View style={styles.opBadge}>
          <Text style={styles.opBadgeText}>+{rule.newPrefix}</Text>
        </View>
      ) : (
        <Text variant="caption" tone="secondary">
          no change
        </Text>
      )}
    </Row>
  );
}

/* ------------------------------------------------------------------ screen */

export default function SettingsScreen() {
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const migrating = OPERATOR_RULES.filter((r) => r.migrating);

  const verifiedNote =
    NUMBERING_VERIFICATION.status === 'confirmed'
      ? `Matches PURA’s official allocation table. Checked ${formatPlanDate(NUMBERING_LAST_VERIFIED)}.`
      : `Based on PURA’s published information. Checked ${formatPlanDate(NUMBERING_LAST_VERIFIED)}.`;

  return (
    <Screen scroll>
      <View style={styles.container}>
        <DeadlineCard />

        <Group title="Your last update" icon="refresh-outline">
          <View style={styles.plainRow}>
            <LastMigrationCard />
          </View>
        </Group>

        <Group
          title="How your numbers change"
          icon="swap-horizontal-outline"
          footnote="Sunyu9 also skips landlines, foreign numbers, and numbers already in the new format."
        >
          <View style={styles.plainRow}>
            <Text variant="caption" tone="secondary" style={styles.explainer}>
              Your number stays the same — a 2-digit network code is added in front, with no space.
            </Text>
            <View style={styles.exampleStrip}>
              <Text style={styles.exampleOld}>7012345</Text>
              <Ionicons name="arrow-forward" size={15} color={colors.textSecondary} />
              <Text style={styles.exampleNew}>
                <Text style={styles.examplePrefix}>87</Text>7012345
              </Text>
            </View>
          </View>
          {migrating.map((rule) => (
            <OperatorRow key={rule.id} rule={rule} />
          ))}
          <Row>
            <View style={styles.opLogoPlaceholder}>
              <Ionicons name="remove" size={18} color={colors.textSecondary} />
            </View>
            <View style={styles.rowText}>
              <Text variant="body" weight="semibold">
                Gamcel &amp; Gamtel
              </Text>
              <Text variant="caption" tone="secondary">
                Starts with 8 or 9
              </Text>
            </View>
            <Text variant="caption" tone="secondary">
              no change
            </Text>
          </Row>
        </Group>

        <Group title="Your privacy" icon="lock-closed-outline" footnote={PRIVACY_VERIFICATION.footnote}>
          {PRIVACY_POINTS.map((point, i) => (
            <Row key={point} first={i === 0}>
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={colors.accentGreen}
                style={styles.checkIcon}
              />
              <Text variant="body" style={styles.rowText}>
                {point}
              </Text>
            </Row>
          ))}
          <Row onPress={() => void Linking.openSettings()}>
            <Ionicons
              name="shield-checkmark"
              size={20}
              color={colors.brand}
              style={styles.checkIcon}
            />
            <View style={styles.rowText}>
              <Text variant="body" weight="semibold">
                {PRIVACY_VERIFICATION.actionTitle}
              </Text>
              <Text variant="caption" tone="secondary">
                {PRIVACY_VERIFICATION.actionSubtitle}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </Row>
        </Group>

        <Group
          title="Where the rules come from"
          icon="document-text-outline"
          footnote={verifiedNote}
        >
          {NUMBERING_SOURCES.map((source, i) => (
            <Row key={source.url} first={i === 0} onPress={() => void Linking.openURL(source.url)}>
              <Text variant="body" style={styles.rowText}>
                {SOURCE_SHORT[source.url] ?? source.label}
              </Text>
              <Ionicons name="open-outline" size={17} color={colors.textSecondary} />
            </Row>
          ))}
        </Group>

        <Group title="About" icon="information-circle-outline">
          <Row first>
            <Text variant="body" style={styles.rowText}>
              Version
            </Text>
            <Text variant="body" tone="secondary">
              {appVersion}
            </Text>
          </Row>
          {SOURCE_URL ? (
            <Row onPress={() => void Linking.openURL(SOURCE_URL)}>
              <View style={styles.rowText}>
                <Text variant="body" weight="semibold">
                  Read the source code
                </Text>
                <Text variant="caption" tone="secondary">
                  Sunyu9 is open source — don’t take our word for it.
                </Text>
              </View>
              <Ionicons name="open-outline" size={17} color={colors.textSecondary} />
            </Row>
          ) : null}
          <View style={styles.plainRow}>
            <Text variant="caption" tone="secondary">
              A free utility to help Gambians move their contacts to the 9-digit format before the
              deadline. Made for The Gambia 🇬🇲
            </Text>
          </View>
        </Group>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xl,
    paddingBottom: spacing.xxl,
  },

  /* groups + rows */
  group: {
    gap: spacing.sm,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  groupTitle: {
    letterSpacing: 0.8,
    fontSize: 12,
  },
  groupCard: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  groupFootnote: {
    paddingHorizontal: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 52,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowPressed: {
    backgroundColor: colors.surface,
  },
  rowText: {
    flex: 1,
    gap: 1,
  },
  plainRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  checkIcon: {
    marginLeft: -1,
  },
  explainer: {
    lineHeight: 18,
  },

  /* operator bits */
  opLogo: {
    borderRadius: radius.sm,
  },
  opLogoPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  opBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.brandTint,
  },
  opBadgeText: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },

  /* before / after example */
  exampleStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
  },
  exampleOld: {
    fontSize: 16,
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
    fontVariant: ['tabular-nums'],
  },
  exampleNew: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  examplePrefix: {
    color: colors.textSecondary,
  },
});
