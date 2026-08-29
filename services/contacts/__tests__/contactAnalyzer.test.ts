import type { AppContact } from '@/types';
import {
  analyzeContact,
  analyzeContacts,
  phoneKey,
} from '../contactAnalyzer';

function contact(id: string, numbers: [label: string, number: string][]): AppContact {
  return {
    id,
    name: `Contact ${id}`,
    givenName: `Contact ${id}`,
    familyName: null,
    phoneNumbers: numbers.map(([label, original], index) => ({
      id: `${id}-p${index}`,
      label,
      original,
      digits: original.replace(/\D+/g, ''),
    })),
  };
}

describe('analyzeContact', () => {
  it('evaluates each number of a contact independently', () => {
    const analyzed = analyzeContact(
      contact('musa', [
        ['mobile', '7123456'], // Africell -> convertible
        ['work', '8491234'], // Gamtel fixed line -> not-applicable
        ['home', '877123456'], // already migrated
      ]),
    );

    expect(analyzed.numbers.map((n) => n.outcome.status)).toEqual([
      'convertible',
      'not-applicable',
      'already-migrated',
    ]);
    expect(analyzed.convertibleCount).toBe(1);
  });

  it('gives each number a stable, unique key', () => {
    const analyzed = analyzeContact(contact('c1', [['mobile', '7123456'], ['other', '3123456']]));
    const keys = analyzed.numbers.map((n) => n.key);
    expect(new Set(keys).size).toBe(2);
    expect(keys[0]).toBe(phoneKey('c1', analyzed.contact.phoneNumbers[0], 0));
  });

  it('carries the write target through the outcome', () => {
    const [national, international] = analyzeContact(
      contact('c', [['mobile', '7123456'], ['work', '+220 7123456']]),
    ).numbers;

    expect(national.outcome.status === 'convertible' && national.outcome.target).toBe('877123456');
    expect(
      international.outcome.status === 'convertible' && international.outcome.target,
    ).toBe('+220877123456');
  });
});

describe('analyzeContacts', () => {
  const contacts: AppContact[] = [
    contact('a', [['mobile', '7123456']]), // 1 convertible
    contact('b', [['mobile', '9123456']]), // Gamcel — nothing to do
    contact('c', [['mobile', '3123456'], ['work', '6123456']]), // 2 convertible
    contact('d', [['mobile', 'not a number']]), // invalid
  ];

  it('splits actionable contacts from the rest and tallies a summary', async () => {
    const result = await analyzeContacts(contacts);

    expect(result.all).toHaveLength(4);
    expect(result.actionable.map((c) => c.contact.id)).toEqual(['a', 'c']);

    expect(result.summary).toMatchObject({
      contactsScanned: 4,
      numbersScanned: 5,
      actionableContacts: 2,
      convertibleNumbers: 3,
      invalid: 1,
    });
  });

  it('reports progress and finishes at 100%', async () => {
    const ticks: [number, number][] = [];
    await analyzeContacts(contacts, {
      chunkSize: 1,
      onProgress: (done, total) => ticks.push([done, total]),
    });

    expect(ticks[0]).toEqual([0, 4]);
    expect(ticks[ticks.length - 1]).toEqual([4, 4]);
  });

  it('handles an empty address book', async () => {
    const result = await analyzeContacts([]);
    expect(result.actionable).toHaveLength(0);
    expect(result.summary.contactsScanned).toBe(0);
  });
});
