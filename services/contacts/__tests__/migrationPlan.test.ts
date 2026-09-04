import { analyzeContacts } from '../contactAnalyzer';
import type { AppContact } from '@/types';
import {
  groupSelectionByContact,
  makeBatchId,
  planContactConversions,
  planConversions,
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

describe('planContactConversions', () => {
  it('returns only the selected convertible numbers, as from → to pairs', async () => {
    const analysis = await analyze([
      contact('musa', [
        ['mobile', '7123456', 'p-mobile'],
        ['work', '8491234', 'p-work'], // fixed line, never changes
        ['home', '3123456', 'p-home'],
      ]),
    ]);
    const analyzed = analysis.actionable[0];
    const selected = new Set([analyzed.numbers[0].key]); // only the mobile

    expect(planContactConversions(analyzed, selected)).toEqual([
      { from: '7123456', to: '877123456' },
    ]);
  });

  it('is empty when nothing is selected for the contact', async () => {
    const analysis = await analyze([contact('a', [['mobile', '7123456']])]);
    expect(planContactConversions(analysis.actionable[0], new Set())).toEqual([]);
  });

  it('uses the grouped, +220-prefixed target', async () => {
    const analysis = await analyze([contact('a', [['mobile', '+220 7123456']])]);
    const analyzed = analysis.actionable[0];
    expect(planContactConversions(analyzed, allKeys(analysis))).toEqual([
      { from: '+220 7123456', to: '+220 87 712 3456' },
    ]);
  });

  it('emits one entry per selected row, even when two rows hold the same number', async () => {
    const analysis = await analyze([
      contact('a', [
        ['mobile', '7123456', 'p1'],
        ['home', '7123456', 'p2'],
      ]),
    ]);
    const analyzed = analysis.actionable[0];
    // both selected → two conversions; the writer consumes one per live row
    expect(planContactConversions(analyzed, allKeys(analysis))).toEqual([
      { from: '7123456', to: '877123456' },
      { from: '7123456', to: '877123456' },
    ]);
    // only the mobile selected → one conversion, so only one row is converted
    const onlyMobile = new Set([analyzed.numbers[0].key]);
    expect(planContactConversions(analyzed, onlyMobile)).toEqual([
      { from: '7123456', to: '877123456' },
    ]);
  });
});

describe('planContactConversions — add mode', () => {
  it('skips a number whose 9-digit twin is already on the contact', async () => {
    const analysis = await analyze([
      contact('a', [
        ['mobile', '7123456', 'p1'],
        ['mobile', '877123456', 'p2'], // the twin — already added
      ]),
    ]);
    const analyzed = analysis.actionable[0];
    expect(analyzed.numbers[0].alreadyPaired).toBe(true);
    expect(planContactConversions(analyzed, allKeys(analysis), 'add')).toEqual([]);
  });

  it('de-dupes two identical old rows into one added number', async () => {
    const analysis = await analyze([
      contact('a', [
        ['mobile', '7123456', 'p1'],
        ['home', '7123456', 'p2'],
      ]),
    ]);
    const analyzed = analysis.actionable[0];
    expect(planContactConversions(analyzed, allKeys(analysis), 'add')).toEqual([
      { from: '7123456', to: '877123456' },
    ]);
    // replace mode still emits one per row
    expect(planContactConversions(analyzed, allKeys(analysis), 'replace')).toHaveLength(2);
  });
});

describe('planConversions', () => {
  it('add mode drops contacts that only hold already-paired numbers', async () => {
    const analysis = await analyze([
      contact('a', [['mobile', '7123456'], ['mobile', '877123456']]),
      contact('b', [['mobile', '3123456']]),
    ]);
    const plans = planConversions(analysis, allKeys(analysis), 'add');
    expect(plans.map((p) => p.contactId)).toEqual(['b']);
  });

  it('planMigration is planConversions in replace mode', async () => {
    const analysis = await analyze([contact('a', [['mobile', '7123456']])]);
    expect(planMigration(analysis, allKeys(analysis))).toEqual(
      planConversions(analysis, allKeys(analysis), 'replace'),
    );
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
    expect(plans.reduce((sum, p) => sum + p.conversions.length, 0)).toBe(3);
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
    expect(plans.find((p) => p.contactId === 'c')!.conversions).toEqual([
      { from: '3123456', to: '833123456' },
    ]);
  });

  it('restricts the run to onlyContactIds', async () => {
    const analysis = await analyze(contacts);
    const plans = planMigration(analysis, allKeys(analysis), new Set(['c']));
    expect(plans.map((p) => p.contactId)).toEqual(['c']);
  });
});

describe('makeBatchId', () => {
  it('is filesystem-safe and stable for a given time', () => {
    const id = makeBatchId(new Date('2026-09-04T10:15:00.000Z'));
    expect(id).toBe('mig_2026-09-04T10-15-00-000Z');
    expect(id).not.toMatch(/[:.]/);
  });
});
