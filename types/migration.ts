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

/**
 * What a single migration run does to the numbers it touches.
 *
 *  - `replace` — swap the old 7-digit value for the new 9-digit one, in place.
 *  - `add`     — keep the old row (relabelled `"<label> (old)"`) and add a new
 *                row holding the 9-digit number. Both numbers stay on the contact
 *                so WhatsApp keeps matching the old one until the person switches.
 *  - `remove`  — drop an old 7-digit row whose 9-digit twin is already present
 *                (the "tidy up later" pass).
 */
export type MigrationOperation = 'replace' | 'add' | 'remove';

/**
 * One reversible edit made to a single phone row, recorded so `undoMigration`
 * can put things back exactly for the `add` / `remove` operations (where the
 * row list changes length and an index-aligned diff would be unsound). Labels
 * here are the app's *friendly* form (`"mobile"`, `""`).
 */
export type RowChange =
  | {
      op: 'relabel';
      rowId: string | null;
      /** The row's number — used to re-find the row on undo. */
      value: string;
      fromLabel: string;
      toLabel: string;
    }
  | {
      op: 'add';
      /** The 9-digit value written into the new row. */
      value: string;
      label: string;
      /** The old row this new number was paired with. */
      pairedOldValue: string;
    }
  | {
      op: 'remove';
      rowId: string | null;
      /** The old 7-digit value that was dropped. */
      value: string;
      label: string;
      /** The 9-digit twin that stayed on the contact. */
      pairedNewValue: string;
    };

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
  /**
   * The per-row edits, for `add` / `remove` runs. Absent on a `replace` run,
   * whose undo is driven by the `originalPhones` ↔ `newPhones` diff instead.
   */
  rowChanges?: RowChange[];
}

/** A single "apply" run — everything needed to undo it. */
export interface MigrationBackup {
  /** Batch id, e.g. `mig_2026-09-04T10-15-00`. */
  id: string;
  createdAt: string;
  contacts: ContactBackup[];
  status: 'applied' | 'undone';
  /** What this run did. Backups written before this field existed are `replace`. */
  operation: MigrationOperation;
}

export interface MigrationFailure {
  contactId: string;
  contactName: string;
  message: string;
}

export interface MigrationResult {
  backupId: string;
  /** What this run did — so a retry / the result sheet stay in the same mode. */
  operation: MigrationOperation;
  updatedContacts: number;
  updatedNumbers: number;
  failures: MigrationFailure[];
}

export interface UndoResult {
  restoredContacts: number;
  failures: MigrationFailure[];
}
