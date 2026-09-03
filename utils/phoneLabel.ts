/**
 * Phone-label normalisation across platforms.
 *
 * `expo-contacts` (SDK 57 class API) returns different things per platform:
 *   - Android: friendly lowercase names — "mobile", "home", "work", … — or a
 *     custom label verbatim.
 *   - iOS: the raw Contacts-framework constant, wrapped as `_$!<Mobile>!$_`,
 *     `_$!<Home>!$_`, …, or a custom label verbatim.
 *
 * The app keeps friendly names everywhere (state, backup, UI) via
 * `friendlyPhoneLabel`, then converts back to the iOS constant immediately
 * before a write with `nativePhoneLabel`, so the Contacts app keeps its
 * localised system labels instead of showing `_$!<Mobile>!$_`. Custom and
 * unrecognised labels pass straight through on both sides.
 */
import { Platform } from 'react-native';

/**
 * Apple's fixed set of standard phone-label constants ⇄ the friendly name the
 * app uses for each. Kept complete so every `_$!<…>!$_` value iOS can hand back
 * round-trips to exactly the same constant on write.
 */
const STANDARD_LABELS = [
  ['_$!<Mobile>!$_', 'mobile'],
  ['_$!<iPhone>!$_', 'iPhone'],
  ['_$!<Home>!$_', 'home'],
  ['_$!<Work>!$_', 'work'],
  ['_$!<Main>!$_', 'main'],
  ['_$!<HomeFAX>!$_', 'home fax'],
  ['_$!<WorkFAX>!$_', 'work fax'],
  ['_$!<OtherFAX>!$_', 'other fax'],
  ['_$!<Pager>!$_', 'pager'],
  ['_$!<Other>!$_', 'other'],
  ['_$!<AppleWatch>!$_', 'Apple Watch'],
] as const;

const TO_FRIENDLY = new Map<string, string>(STANDARD_LABELS.map(([ios, friendly]) => [ios, friendly]));
const TO_IOS = new Map<string, string>(
  STANDARD_LABELS.map(([ios, friendly]) => [friendly.toLowerCase(), ios]),
);

/**
 * Raw device label → the friendly name the app stores and displays. An empty
 * result means the number has no label; `formatLabel` renders that as "Other"
 * for display without persisting a label the user never set.
 */
export function friendlyPhoneLabel(raw: string | null | undefined): string {
  const trimmed = (raw ?? '').trim();
  if (trimmed.length === 0) {
    return '';
  }
  return TO_FRIENDLY.get(trimmed) ?? trimmed;
}

/** Friendly name → the label string to hand back to `expo-contacts` on a write. */
export function nativePhoneLabel(friendly: string): string {
  const trimmed = friendly.trim();
  if (Platform.OS !== 'ios') {
    return trimmed;
  }
  return TO_IOS.get(trimmed.toLowerCase()) ?? trimmed;
}
