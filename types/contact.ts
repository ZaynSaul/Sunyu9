/**
 * App-level contact model.
 *
 * This is a deliberately small, platform-free shape derived from whatever
 * `expo-contacts` returns. Screens, the store, and (later) the numbering engine
 * only ever see this model — never the raw native objects.
 */

/** A single phone entry belonging to a contact. */
export interface AppPhoneNumber {
  /**
   * Stable id of this phone row from the device contacts database.
   * Present on both platforms for existing numbers; may be `null` for
   * malformed rows. Used as a React key and, later, to target updates.
   */
  id: string | null;
  /** Raw label as stored on the device, e.g. `"mobile"`, `"work"`, `"home"`. */
  label: string;
  /** The number exactly as stored on the device (spaces, `+`, dashes intact). */
  original: string;
  /** `original` stripped to digits only (no `+`, spaces, or punctuation). */
  digits: string;
}

/** A contact with at least one phone number. */
export interface AppContact {
  /** Stable id from the device contacts database. */
  id: string;
  /** Best-effort display name; falls back to the first number when unnamed. */
  name: string;
  givenName: string | null;
  familyName: string | null;
  phoneNumbers: AppPhoneNumber[];
}

/** Progress callback shape shared by the reader and (later) the updater. */
export type ProgressCallback = (processed: number, total: number) => void;
