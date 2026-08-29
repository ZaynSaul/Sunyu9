/**
 * Screen-facing helper for the contact permission flow.
 *
 * Wraps the store's permission actions and adds the one piece of platform glue
 * the UI needs: when permission is `blocked`, `request()` can no longer show a
 * system prompt, so we send the user to the OS settings page instead.
 */
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';

import { useContactStore } from '@/store/contactStore';
import type { PermissionSnapshot } from '@/types';

export interface UseContactPermission {
  permission: PermissionSnapshot | null;
  /** True while an initial/refresh check is in flight. */
  checking: boolean;
  /** Prompt for access, or open Settings if the OS will no longer prompt. */
  request: () => Promise<PermissionSnapshot>;
  /** Re-read the current status (used when returning from Settings). */
  refresh: () => Promise<PermissionSnapshot>;
}

export function useContactPermission(): UseContactPermission {
  const permission = useContactStore((s) => s.permission);
  const refreshPermission = useContactStore((s) => s.refreshPermission);
  const requestPermission = useContactStore((s) => s.requestPermission);
  const [checking, setChecking] = useState(permission === null);

  const refresh = useCallback(async () => {
    setChecking(true);
    try {
      return await refreshPermission();
    } finally {
      setChecking(false);
    }
  }, [refreshPermission]);

  // Initial check on mount.
  useEffect(() => {
    if (permission === null) {
      void refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-check when the app returns to the foreground (e.g. back from Settings).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        void refresh();
      }
    });
    return () => sub.remove();
  }, [refresh]);

  const request = useCallback(async () => {
    const current = permission ?? (await refreshPermission());
    if (current.state === 'blocked') {
      await Linking.openSettings();
      return current;
    }
    return requestPermission();
  }, [permission, refreshPermission, requestPermission]);

  return { permission, checking, request, refresh };
}
