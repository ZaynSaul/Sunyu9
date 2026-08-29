import { analyzeContacts } from '../contactAnalyzer';
import type { AppContact } from '@/types';
import {
  groupSelectionByContact,
  makeBatchId,
  planContactPatch,
  planMigration,
} from '../migrationPlan';

function contact(id: string, numbers: [label: string, number: string, phoneId?: string][]): AppContact {
  return {
    id,
    name: `Contact ${id}`,
    givenName: null,
    familyName: null,
    phoneNumbers: numbers.map(([label, original, phoneId], index) => ({
      id: phoneId ?? `${id}-p${index}`,
      label,
      original,
      digits: original.replace(/\D+/g, ''),
    })),
  };
}

async function analyze(contacts: AppContact[]) {
  return analyzeContacts(contacts);
}

/** All convertible keys, as the store would default the selection. */
function allKeys(analysis: Awaited<ReturnType<typeof analyze>>): Set<string> {
  const keys = new Set<string>();
  for (const c of analysis.actionable) {
    for (const n of c.numbers) {
      if (n.convertible) keys.add(n.key);
    }
  }
  return keys;
}

describe('planContactPatch', () => {
  it('rebuilds the full phone list, changing only the selected convertible rows', async () => {
    const analysis = await analyze([
      contact('musa', [
        ['mobile', '7123456', 'p-mobile'],
        ['work', '8491234', 'p-work'], // fixed line, never changes
        ['home', '3123456', 'p-home'],
      ]),
    ]);
    const analyzed = analysis.actionable[0];
    const selected = new Set([analyzed.numbers[0].key]); // only the mobile

    const plan = planContactPatch(analyzed, selected)!;

    expect(plan.nextPhones).toEqual([
      { id: 'p-mobile', label: 'mobile', number: '877123456' },
      { id: 'p-work', label: 'work', number: '8491234' },
      { id: 'p-home', label: 'home', number: '3123456' },
    ]);
    expect(plan.changedCount).toBe(1);
    expect(plan.backup.originalPhones).toEqual([
      { id: 'p-mobile', label: 'mobile', number: '7123456' },
      { id: 'p-work', label: 'work', number: '8491234' },
      { id: 'p-home', label: 'home', number: '3123456' },
    ]);
    expect(plan.backup.newPhones).toEqual(plan.nextPhones);
    expect(plan.backup.changedPhoneTags).toEqual(['p-mobile']);
  });

  it('returns null when nothing is selected for the contact', async () => {
    const analysis = await analyze([contact('a', [['mobile', '7123456']])]);
    expect(planContactPatch(analysis.actionable[0], new Set())).toBeNull();
  });

  it('preserves international formatting choice via the outcome target', async () => {
    const analysis = await analyze([contact('a', [['mobile', '+220 7123456']])]);
    const analyzed = analysis.actionable[0];
    const plan = planContactPatch(analyzed, allKeys(analysis))!;
    expect(plan.nextPhones[0].number).toBe('+220877123456');
  });
});

describe('planMigration / groupSelectionByContact', () => {
  const contacts = [
    contact('a', [['mobile', '7123456']]),
    contact('b', [['mobile', '9123456']]), // Gamcel, nothing to do
    contact('c', [['mobile', '3123456'], ['work', '6123456']]),
  ];

  it('only plans contacts that have a selected change', async () => {
    const analysis = await analyze(contacts);
    const plans = planMigration(analysis, allKeys(analysis));
    expect(plans.map((p) => p.contactId).sort()).toEqual(['a', 'c']);
    expect(plans.reduce((sum, p) => sum + p.changedCount, 0)).toBe(3);
  });

  it('drops a contact once its selection is cleared', async () => {
    const analysis = await analyze(contacts);
    const keys = allKeys(analysis);
    // clear contact c's "work" number only
    const cWork = analysis.actionable
      .find((x) => x.contact.id === 'c')!
      .numbers.find((n) => n.phone.label === 'work')!.key;
    keys.delete(cWork);

    const grouped = groupSelectionByContact(analysis, keys);
    expect([...grouped.keys()].sort()).toEqual(['a', 'c']);

    const plans = planMigration(analysis, keys);
    expect(plans.find((p) => p.contactId === 'c')!.changedCount).toBe(1);
  });
});

describe('makeBatchId', () => {
  it('is filesystem-safe and stable for a given time', () => {
    const id = makeBatchId(new Date('2026-09-04T10:15:00.000Z'));
    expect(id).toBe('mig_2026-09-04T10-15-00-000Z');
    expect(id).not.toMatch(/[:.]/);
  });
});
