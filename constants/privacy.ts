/**
 * The "nothing leaves your phone" trust story, worded per platform.
 *
 * Android: a shipping build (`APP_VARIANT=release`) physically carries no
 * INTERNET permission — see `BLOCKED_ANDROID_PERMISSIONS` in `app.config.js`. The
 * OS app-permissions screen is the proof: there is literally nothing to turn on.
 *
 * iOS: an app cannot drop its networking capability and there is no user-facing
 * toggle for it, so the Android claim ("no Internet access to turn on") would be
 * false here. The equivalent proof is **App Privacy Report** (Settings → Privacy
 * & Security → App Privacy Report), which logs every domain an app contacts —
 * Sunyu9's entry stays empty because the code makes no network calls at all.
 */
import { Platform } from 'react-native';

import { IS_HARDENED_BUILD } from '@/constants/app';

export interface PrivacyVerification {
  /** Optional caption shown under the "Your privacy" group. */
  footnote?: string;
  /** Title of the tappable "verify it yourself" row. */
  actionTitle: string;
  /** Subtitle of that row. */
  actionSubtitle: string;
}

const ANDROID: PrivacyVerification = {
  footnote: IS_HARDENED_BUILD
    ? undefined
    : 'This developer build keeps internet access so the code can reload while building. The published app has it removed.',
  actionTitle: 'Check it yourself',
  actionSubtitle: IS_HARDENED_BUILD
    ? 'Open Permissions — Sunyu9 has no Internet access to turn on.'
    : 'Open the app’s permissions in system settings.',
};

const IOS: PrivacyVerification = {
  footnote: IS_HARDENED_BUILD
    ? 'iOS won’t let an app remove network access, so the proof here is different: turn on App Privacy Report in Settings → Privacy & Security and Sunyu9 will show no network activity, ever.'
    : 'This developer build talks to a local server so the code can reload while building. The published app makes no network connections at all.',
  actionTitle: 'Check it yourself',
  actionSubtitle: 'Open Sunyu9’s settings — Contacts is the only permission it can ask for.',
};

export const PRIVACY_VERIFICATION: PrivacyVerification = Platform.select({
  ios: IOS,
  android: ANDROID,
  default: ANDROID,
});
