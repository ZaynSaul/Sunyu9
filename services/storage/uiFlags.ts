/**
 * Tiny per-device UI flags — one-time hints the user has dismissed, etc.
 * Local only, best-effort: a missing or unreadable value just means "not set".
 */
import { z } from 'zod';

import { getItem, setItem } from './storageService';

const uiFlagsSchema = z.object({
  /** The user closed the "how this works" strip on the review screen. */
  reviewIntroDismissed: z.boolean().optional(),
});

export type UiFlags = z.infer<typeof uiFlagsSchema>;

export async function loadUiFlags(): Promise<UiFlags> {
  return (await getItem('ui:flags', uiFlagsSchema)) ?? {};
}

export async function setUiFlag<K extends keyof UiFlags>(key: K, value: UiFlags[K]): Promise<void> {
  const current = await loadUiFlags();
  await setItem('ui:flags', { ...current, [key]: value });
}
