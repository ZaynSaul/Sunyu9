import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ProgressBar, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { getDeadline } from '@/utils/deadline';

/**
 * The shared migration countdown: a filled brand-tint card with the day count,
 * a progress bar through the dual-run window, and the two plan dates. Same
 * component on the home screen and in Settings so the number can never disagree
 * with itself.
 */
export function DeadlineCard() {
  const deadline = getDeadline();
  const showBar = deadline.phase !== 'before-dual-run';

  return (
    <View style={styles.card}>
      <View style={styles.labelRow}>
        <Ionicons name="hourglass-outline" size={13} color={colors.textSecondary} />
        <Text style={styles.label}>COUNTDOWN</Text>
      </View>

      <Text style={styles.big}>{deadline.headline}</Text>
      <Text style={styles.sub}>{deadline.caption}</Text>

      {showBar ? (
        <View style={styles.barBlock}>
          <ProgressBar progress={deadline.windowProgress} />
        </View>
      ) : null}

      <View style={styles.rule} />

      <Milestone
        done={deadline.daysToDualRun <= 0}
        date={deadline.dualRunStartLabel}
        label="Both formats work"
      />
      <Milestone
        done={deadline.daysToCutoff <= 0}
        date={deadline.cutoffLabel}
        label="7-digit numbers end"
      />
    </View>
  );
}

function Milestone({ done, date, label }: { done: boolean; date: string; label: string }) {
  return (
    <View style={styles.milestone}>
      <View style={[styles.dot, done && styles.dotDone]}>
        {done ? <Ionicons name="checkmark" size={10} color={colors.textInverse} /> : null}
      </View>
      <Text style={styles.date}>{date}</Text>
      <Text style={styles.milestoneLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.brandTint,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  big: {
    color: colors.brandDark,
    fontSize: 30,
    // Explicit — otherwise the base Text's `body` lineHeight (~23) wins over
    // this 30px size and iOS clips the glyphs into the shorter line box.
    lineHeight: 36,
    fontWeight: '800',
    marginTop: spacing.sm,
  },
  sub: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  barBlock: {
    marginTop: spacing.md,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.brand,
    opacity: 0.25,
    marginVertical: spacing.md,
  },
  milestone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 4,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  date: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    width: 92,
  },
  milestoneLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    flexShrink: 1,
  },
});
