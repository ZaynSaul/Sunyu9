/**
 * Sunyu9 — Expo app config.
 *
 * Offline-first utility that upgrades a phone's contacts from the old 7-digit
 * Gambian numbers to the new 9-digit format. Contacts are read and written
 * on-device only; nothing is uploaded. See README.md for numbering-plan sources.
 */

const CONTACTS_PERMISSION =
  'Sunyu9 reads your contacts on this device only, to find numbers that still use ' +
  'the old 7-digit format. Your contacts are never uploaded or shared.';

/**
 * Trust hardening: release builds carry no networking permissions at all, so the
 * OS app-info screen itself proves the app cannot upload anything.
 *
 * Driven by a single flag: `APP_VARIANT=release`. The `preview` and `production`
 * EAS profiles set it in their `env` block (see eas.json); a local release build
 * is `APP_VARIANT=release expo run:android --variant release`. A plain debug
 * prebuild (`expo run:android`) leaves it unset and keeps INTERNET so Metro can
 * connect.
 */
const IS_RELEASE_BUILD = process.env.APP_VARIANT === 'release';

const BLOCKED_ANDROID_PERMISSIONS = IS_RELEASE_BUILD
  ? [
      // networking — the whole point of the hardening
      'android.permission.INTERNET',
      'android.permission.ACCESS_NETWORK_STATE',
      'android.permission.ACCESS_WIFI_STATE',
      // pulled in by React Native but never used by Sunyu9 — dropping them keeps
      // the OS permission screen down to just "Contacts"
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.VIBRATE',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ]
  : [];

export default {
  expo: {
    name: 'Sunyu9',
    slug: 'sunyu9',
    owner: 'saulzayn',
    scheme: 'sunyu9',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    platforms: ['ios', 'android'],
    backgroundColor: '#FFFFFF',
    primaryColor: '#1D4ED8',
    runtimeVersion: '1.0.0',
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.zayn.sunyu9',
      infoPlist: {
        CFBundleAllowMixedLocalizations: true,
        ITSAppUsesNonExemptEncryption: false,
        
      },
    },
    android: {
      package: 'com.zayn.sunyu9',
      adaptiveIcon: {
        backgroundColor: '#0C1C8C',
        foregroundImage: './assets/android-icon.png',
        monochromeImage: './assets/android-icon.png',
      },
      predictiveBackGestureEnabled: false,
      permissions: [
        'android.permission.READ_CONTACTS',
        'android.permission.WRITE_CONTACTS',
      ],
      blockedPermissions: BLOCKED_ANDROID_PERMISSIONS,
    },
    plugins: [
      'expo-router',
      'expo-status-bar',
      [
        'expo-splash-screen',
        {
          image: './assets/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#0C1C8C',
          dark: {
            image: './assets/splash-icon.png',
            backgroundColor: '#0C1C8C',
          },
        },
      ],
      [
        'expo-contacts',
        {
          contactsPermission: CONTACTS_PERMISSION,
        },
      ],
      [
        'expo-build-properties',
        {
          android: {
            hardwareAccelerated: true,
            largeHeap: true,
            enableMinifyInReleaseBuilds: true,
            enableShrinkResourcesInReleaseBuilds: true,
            usesCleartextTraffic: false,
            universalApk: false,
            compileSdkVersion: 36,
            targetSdkVersion: 35,
            buildToolsVersion: '36.0.0',
            minSdkVersion: 24,
          },
          ios: {
            deploymentTarget: '16.4',
          },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      /**
       * True when this build ships with networking permissions stripped (see
       * IS_RELEASE_BUILD above). The app uses it to decide whether it can make
       * the strong "no internet permission — verify it yourself" claim.
       */
      hardened: IS_RELEASE_BUILD,
      /** Public source repository. Shown in Settings; leave '' to hide the link. */
      sourceUrl: 'https://github.com/ZaynSaul/Sunyu9',
      eas: {
        projectId: '15ff8e97-aa47-4e61-8a74-cf37db942a71',
      },
    },
  },
};
