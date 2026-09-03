/**
 * Types for applying conversions to the address book and undoing them.
 */

/** One phone row as it should be written to a contact. */
export interface PatchPhone {
  /** Existing row id to update in place; `undefined` = create a new row. */
  id?: string;
  /** Friendly label ("mobile", "home", …); omitted / empty means "no label". */
  label?: string;
  number: string;
}

/** The complete pre-change snapshot of one contact's phone list. */
export interface ContactBackup {
  contactId: string;
  contactName: string;
  /** Every phone the contact had before we touched it — the full list. */
  originalPhones: PatchPhone[];
  /** The full list we wrote in its place — same length/order as `originalPhones`. */
  newPhones: PatchPhone[];
  /** Ids (or index tags) of the rows this migration changed — for display. */
  changedPhoneTags: string[];
}

/** A single "apply" run — everything needed to undo it. */
export interface MigrationBackup {
  /** Batch id, e.g. `mig_2026-09-04T10-15-00`. */
  id: string;
  createdAt: string;
  contacts: ContactBackup[];
  status: 'applied' | 'undone';
}

export interface MigrationFailure {
  contactId: string;
  contactName: string;
  message: string;
}

export interface MigrationResult {
  backupId: string;
  updatedContacts: number;
  updatedNumbers: number;
  failures: MigrationFailure[];
}

export interface UndoResult {
  restoredContacts: number;
  failures: MigrationFailure[];
}
