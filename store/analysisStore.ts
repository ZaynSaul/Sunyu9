/**
 * Holds the result of running the numbering engine over the address book, plus
 * the user's per-number selection for the preview screen.
 *
 * Selection defaults to "every convertible number checked". The user can
 * deselect individual numbers or whole contacts before confirming.
 */
import { create } from 'zustand';

import { analyzeContacts, type ContactAnalysis } from '@/services/contacts/contactAnalyzer';
import type { AppContact } from '@/types';

export type AnalysisStatus = 'idle' | 'analyzing' | 'ready' | 'error';

interface Progress {
  done: number;
  total: number;
}

interface AnalysisState {
  status: AnalysisStatus;
  progress: Progress;
  analysis: ContactAnalysis | null;
  /** Keys (`phoneKey`) of numbers the user has chosen to update. */
  selected: Set<string>;
  error: string | null;

  analyze: (contacts: AppContact[]) => Promise<void>;
  toggleNumber: (key: string) => void;
  /** Select all of a contact's convertible numbers, or clear them all. */
  setContactSelected: (contactId: string, selected: boolean) => void;
  selectAll: () => void;
  selectNone: () => void;
  reset: () => void;
}

const INITIAL_PROGRESS: Progress = { done: 0, total: 0 };

/** How many numbers / contacts the current selection covers. */
export function selectionStats(
  analysis: ContactAnalysis | null,
  selected: Set<string>,
): { numbers: number; contacts: number } {
  if (!analysis || selected.size === 0) {
    return { numbers: 0, contacts: 0 };
  }
  let numbers = 0;
  let contacts = 0;
  for (const contact of analysis.actionable) {
    const picked = contact.numbers.filter((n) => n.convertible && selected.has(n.key)).length;
    if (picked > 0) {
      contacts += 1;
      numbers += picked;
    }
  }
  return { numbers, contacts };
}

function allConvertibleKeys(analysis: ContactAnalysis): Set<string> {
  const keys = new Set<string>();
  for (const contact of analysis.actionable) {
    for (const number of contact.numbers) {
      if (number.convertible) {
        keys.add(number.key);
      }
    }
  }
  return keys;
}

export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  status: 'idle',
  progress: INITIAL_PROGRESS,
  analysis: null,
  selected: new Set(),
  error: null,

  analyze: async (contacts) => {
    if (get().status === 'analyzing') {
      return;
    }
    set({ status: 'analyzing', error: null, progress: { done: 0, total: contacts.length } });
    try {
      const analysis = await analyzeContacts(contacts, {
        onProgress: (done, total) => set({ progress: { done, total } }),
      });
      set({ analysis, selected: allConvertibleKeys(analysis), status: 'ready' });
    } catch (error) {
      console.warn('[analysisStore] analysis failed', error);
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'Could not check your numbers.',
      });
    }
  },

  toggleNumber: (key) => {
    const selected = new Set(get().selected);
    if (selected.has(key)) {
      selected.delete(key);
    } else {
      selected.add(key);
    }
    set({ selected });
  },

  setContactSelected: (contactId, isSelected) => {
    const { analysis } = get();
    if (!analysis) return;
    const contact = analysis.actionable.find((c) => c.contact.id === contactId);
    if (!contact) return;

    const selected = new Set(get().selected);
    for (const number of contact.numbers) {
      if (!number.convertible) continue;
      if (isSelected) {
        selected.add(number.key);
      } else {
        selected.delete(number.key);
      }
    }
    set({ selected });
  },

  selectAll: () => {
    const { analysis } = get();
    if (analysis) {
      set({ selected: allConvertibleKeys(analysis) });
    }
  },

  selectNone: () => set({ selected: new Set() }),

  reset: () =>
    set({
      status: 'idle',
      progress: INITIAL_PROGRESS,
      analysis: null,
      selected: new Set(),
      error: null,
    }),
}));
