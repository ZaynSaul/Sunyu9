/**
 * Contact-permission state, normalised across iOS and Android into the small set
 * of cases the UI actually needs to branch on.
 */
export type PermissionState =
  /** Full access to the address book. */
  | 'granted'
  /** iOS 18+ partial access — the user picked a subset of contacts. */
  | 'limited'
  /** Not yet asked; a prompt can still be shown. */
  | 'undetermined'
  /** Denied but the OS will still show a prompt if asked again (Android). */
  | 'denied'
  /** Denied and the OS will not prompt again — user must go to Settings. */
  | 'blocked';

export interface PermissionSnapshot {
  state: PermissionState;
  /** True when contacts can be read (`granted` or `limited`). */
  canReadContacts: boolean;
  /** True when calling `requestPermission()` could still show a system prompt. */
  canAskAgain: boolean;
}
