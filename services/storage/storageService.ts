/**
 * Thin, schema-validated wrapper around AsyncStorage.
 *
 * Everything the app persists is local to the device — there is no server. All
 * keys are namespaced under `gn9:` so the app's data is easy to identify and
 * clear. Reads are validated with a Zod schema; corrupt or shape-changed data
 * resolves to `null` rather than throwing, so a bad value can never brick a screen.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ZodType } from 'zod';

const NAMESPACE = 'gn9:';

export type StorageKey =
  /** The most recent migration batch, for Undo (later milestone). */
  | 'migration:last'
  /** User settings (later milestone). */
  | 'settings';

const namespaced = (key: StorageKey): string => `${NAMESPACE}${key}`;

/** Read and validate a value. Returns `null` if missing, unparseable, or invalid. */
export async function getItem<T>(key: StorageKey, schema: ZodType<T>): Promise<T | null> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(namespaced(key));
  } catch (error) {
    console.warn(`[storage] failed to read "${key}"`, error);
    return null;
  }
  if (raw == null) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn(`[storage] value for "${key}" is not valid JSON — ignoring`);
    return null;
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    console.warn(`[storage] value for "${key}" failed validation — ignoring`, result.error.issues);
    return null;
  }
  return result.data;
}

/** Serialise and persist a value. */
export async function setItem<T>(key: StorageKey, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(namespaced(key), JSON.stringify(value));
  } catch (error) {
    console.warn(`[storage] failed to write "${key}"`, error);
    throw error;
  }
}

/** Remove a single value. */
export async function removeItem(key: StorageKey): Promise<void> {
  try {
    await AsyncStorage.removeItem(namespaced(key));
  } catch (error) {
    console.warn(`[storage] failed to remove "${key}"`, error);
  }
}

/** Remove every key this app owns. */
export async function clearAll(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const owned = keys.filter((k) => k.startsWith(NAMESPACE));
  if (owned.length > 0) {
    await AsyncStorage.multiRemove(owned);
  }
}
