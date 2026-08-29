/**
 * Runtime-readable build facts, sourced from `app.config.js` -> `expo.extra`.
 * Kept tiny and dependency-light so any module can import it.
 */
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as {
  hardened?: boolean;
  sourceUrl?: string;
};

/**
 * This build has no networking permissions at all (release / EAS preview /
 * production). Debug builds keep INTERNET so Metro can connect, so this is
 * `false` there — the UI must not claim otherwise.
 */
export const IS_HARDENED_BUILD = extra.hardened === true;

/** Public source repository, or `''` when not configured. */
export const SOURCE_URL = typeof extra.sourceUrl === 'string' ? extra.sourceUrl.trim() : '';
