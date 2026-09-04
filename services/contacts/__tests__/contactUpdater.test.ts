import { analyzeContacts } from '../contactAnalyzer';
import { applyMigration, undoMigration } from '../contactUpdater';
import * as backupModule from '../contactBackup';
import type { AppContact, MigrationBackup } from '@/types';

const mockGetPhones = jest.fn();
const mockPatch = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-contacts', () => ({
  Contact: jest.fn().mockImplementation((id: string) => ({
    getPhones: () => mockGetPhones(id),
    patch: (arg: unknown) => mockPatch(id, arg),
  })),
}));

jest.mock('../contactBackup', () => ({
  saveBackup: jest.fn().mockResolvedValue(undefined),
}));

// Faithful mini-version of the iOS label mapping so this suite stays about the
// updater. The real mapping is covered by phoneLabel.test.
jest.mock('@/utils/phoneLabel', () => {
  const toFriendly: Record<string, string> = {
    '_$!<Mobile>!$_': 'mobile',
    '_$!<Work>!$_': 'work',
    '_$!<Home>!$_': 'home',
  };
  const toNative: Record<string, string> = {
    mobile: '_$!<Mobile>!$_',
    work: '_$!<Work>!$_',
    home: '_$!<Home>!$_',
  };
  return {
    friendlyPhoneLabel: (raw?: string | null) => {
      const t = (raw ?? '').trim();
      return t ? (toFriendly[t] ?? t) : '';
    },
    nativePhoneLabel: (friendly: string) => {
      const t = friendly.trim();
      return t ? (toNative[t.toLowerCase()] ?? t) : '';
    },
  };
});

const saveBackup = backupModule.saveBackup as jest.Mock;

beforeEach(() => {
  mockGetPhones.mockReset();
  mockPatch.mockClear();
  saveBackup.mockClear();
});

// ── applyMigration ───────────────────────────────────────────────────────────

function contactWith(numbers: [label: string, original: string][]): AppContact {
  return {
    id: 'c1',
    name: 'Awa',
    givenName: null,
    familyName: null,
    phoneNumbers: numbers.map(([label, original], i) => ({
      id: `scan-p${i}`,
      label,
      original,
      digits: original.replace(/\D+/g, ''),
    })),
  };
}

async function planFor(contact: AppContact) {
  const analysis = await analyzeContacts([contact]);
  const selected = new Set(
    analysis.actionable.flatMap((c) => c.numbers.filter((n) => n.convertible).map((n) => n.key)),
  );
  return { analysis, selected };
}

describe('applyMigration', () => {
  it('converts the matching number against the live list and keeps the rest', async () => {
    const { analysis, selected } = await planFor(
      contactWith([
        ['mobile', '7012345'], // Africell → convertible
        ['work', '8491234'], // Gamtel fixed line → left alone
      ]),
    );
    mockGetPhones.mockResolvedValue([
      { id: 'live-p1', label: '_$!<Mobile>!$_', number: '7012345' },
      { id: 'live-p2', label: '_$!<Work>!$_', number: '8491234' },
    ]);

    const result = await applyMigration({ analysis, selected });

    // Patched with the LIVE ids, not the scan ids; unchanged row carried along.
    expect(mockPatch).toHaveBeenCalledWith('c1', {
      phones: [
        { id: 'live-p1', number: '877012345' },
        { id: 'live-p2', number: '8491234' },
      ],
    });
    expect(result).toMatchObject({ updatedContacts: 1, updatedNumbers: 1, failures: [] });

    const saved = saveBackup.mock.calls.at(-1)![0] as MigrationBackup;
    expect(saved.contacts[0]).toEqual({
      contactId: 'c1',
      contactName: 'Awa',
      originalPhones: [
        { id: 'live-p1', label: 'mobile', number: '7012345' },
        { id: 'live-p2', label: 'work', number: '8491234' },
      ],
      newPhones: [
        { id: 'live-p1', label: 'mobile', number: '877012345' },
        { id: 'live-p2', label: 'work', number: '8491234' },
      ],
      changedPhoneTags: ['live-p1'],
    });
  });

  it('skips a contact whose number changed since the scan (no write, no failure)', async () => {
    const { analysis, selected } = await planFor(contactWith([['mobile', '7012345']]));
    mockGetPhones.mockResolvedValue([{ id: 'live-p1', label: '_$!<Mobile>!$_', number: '9990000' }]);

    const result = await applyMigration({ analysis, selected });

    expect(mockPatch).not.toHaveBeenCalled();
    expect(result).toMatchObject({ updatedContacts: 0, updatedNumbers: 0, failures: [] });
    expect(saveBackup).not.toHaveBeenCalled();
  });

  it('records a failure and continues when the read throws', async () => {
    const { analysis, selected } = await planFor(contactWith([['mobile', '7012345']]));
    mockGetPhones.mockRejectedValue(new Error('contact not found'));

    const result = await applyMigration({ analysis, selected });

    expect(result.updatedContacts).toBe(0);
    expect(result.failures).toEqual([
      { contactId: 'c1', contactName: 'Awa', message: 'contact not found' },
    ]);
  });

  it('does not send a label for an unlabeled live row', async () => {
    const { analysis, selected } = await planFor(contactWith([['mobile', '7012345']]));
    mockGetPhones.mockResolvedValue([
      { id: 'live-p1', label: '_$!<Mobile>!$_', number: '7012345' },
      { id: 'live-p2', label: undefined, number: '5551234' }, // unlabeled, untouched
    ]);

    await applyMigration({ analysis, selected });

    expect(mockPatch).toHaveBeenCalledWith('c1', {
      phones: [
        { id: 'live-p1', number: '877012345' },
        { id: 'live-p2', number: '5551234' },
      ],
    });
    const saved = saveBackup.mock.calls.at(-1)![0] as MigrationBackup;
    expect(saved.contacts[0].originalPhones[1]).toEqual({ id: 'live-p2', number: '5551234' });
  });

  it('converts only as many rows as the user selected when a number repeats', async () => {
    // Two rows hold 7012345; the user selected only the "mobile" one.
    const analysis = await analyzeContacts([
      {
        id: 'c1',
        name: 'Awa',
        givenName: null,
        familyName: null,
        phoneNumbers: [
          { id: 's1', label: 'mobile', original: '7012345', digits: '7012345' },
          { id: 's2', label: 'home', original: '7012345', digits: '7012345' },
        ],
      },
    ]);
    const mobileKey = analysis.actionable[0].numbers[0].key;
    mockGetPhones.mockResolvedValue([
      { id: 'live-1', label: '_$!<Mobile>!$_', number: '7012345' },
      { id: 'live-2', label: '_$!<Home>!$_', number: '7012345' },
    ]);

    const result = await applyMigration({ analysis, selected: new Set([mobileKey]) });

    expect(result.updatedNumbers).toBe(1);
    expect(mockPatch).toHaveBeenCalledWith('c1', {
      phones: [
        { id: 'live-1', number: '877012345' },
        { id: 'live-2', number: '7012345' }, // the unselected duplicate is left alone
      ],
    });
  });

  it('matches numbers stored with surrounding whitespace', async () => {
    const { analysis, selected } = await planFor(contactWith([['mobile', '7012345']]));
    mockGetPhones.mockResolvedValue([{ id: 'live-1', label: '_$!<Mobile>!$_', number: ' 7012345\n' }]);

    const result = await applyMigration({ analysis, selected });

    expect(result.updatedNumbers).toBe(1);
    expect(mockPatch).toHaveBeenCalledWith('c1', { phones: [{ id: 'live-1', number: '877012345' }] });
  });
});

// ── undoMigration ────────────────────────────────────────────────────────────

function makeBackup(overrides: Partial<MigrationBackup['contacts'][number]> = {}): MigrationBackup {
  return {
    id: 'mig_2026-09-04T00-00-00-000Z',
    createdAt: '2026-09-04T00:00:00.000Z',
    status: 'applied',
    operation: 'replace',
    contacts: [
      {
        contactId: 'c1',
        contactName: 'Awa',
        originalPhones: [
          { id: 'p1', label: 'mobile', number: '7012345' },
          { id: 'p2', label: 'work', number: '4441122' },
        ],
        newPhones: [
          { id: 'p1', label: 'mobile', number: '877012345' },
          { id: 'p2', label: 'work', number: '4441122' },
        ],
        changedPhoneTags: ['p1'],
        ...overrides,
      },
    ],
  };
}

describe('undoMigration', () => {
  it('reverts only the numbers it changed, keyed on the live ids', async () => {
    // Post-apply state: p1 was converted, plus a number the user added since.
    mockGetPhones.mockResolvedValue([
      { id: 'new-1', label: '_$!<Mobile>!$_', number: '877012345' },
      { id: 'new-2', label: '_$!<Work>!$_', number: '4441122' },
      { id: 'new-3', label: '_$!<Home>!$_', number: '9990000' }, // added after apply
    ]);

    const result = await undoMigration({ backup: makeBackup() });

    expect(result).toMatchObject({ restoredContacts: 1, failures: [] });
    expect(mockPatch).toHaveBeenCalledWith('c1', {
      phones: [
        { id: 'new-1', number: '7012345' }, // reverted
        { id: 'new-2', number: '4441122' }, // untouched
        { id: 'new-3', number: '9990000' }, // the user's later addition survives
      ],
    });
  });

  it('does nothing when the converted number is no longer on the contact', async () => {
    mockGetPhones.mockResolvedValue([
      { id: 'new-1', label: '_$!<Mobile>!$_', number: '5551111' }, // user changed it
    ]);

    const result = await undoMigration({ backup: makeBackup() });

    expect(mockPatch).not.toHaveBeenCalled();
    expect(result.restoredContacts).toBe(0);
    expect(result.failures).toEqual([]);
  });

  it('records a failure when no changes were recorded for the contact', async () => {
    const result = await undoMigration({ backup: makeBackup({ originalPhones: [], newPhones: [] }) });

    expect(mockPatch).not.toHaveBeenCalled();
    expect(result.restoredContacts).toBe(0);
    expect(result.failures).toHaveLength(1);
  });
});

// ── applyMigration — "add" operation ─────────────────────────────────────────

describe('applyMigration (operation: add)', () => {
  it('keeps the old row (relabelled) and appends the new number', async () => {
    const { analysis, selected } = await planFor(contactWith([['mobile', '7012345']]));
    mockGetPhones.mockResolvedValue([{ id: 'live-1', label: '_$!<Mobile>!$_', number: '7012345' }]);

    const result = await applyMigration({ analysis, selected, operation: 'add' });

    expect(mockPatch).toHaveBeenCalledWith('c1', {
      phones: [
        { id: 'live-1', label: 'mobile (old)', number: '7012345' },
        { label: '_$!<Mobile>!$_', number: '877012345' },
      ],
    });
    expect(result).toMatchObject({ operation: 'add', updatedContacts: 1, updatedNumbers: 1 });

    const saved = saveBackup.mock.calls.at(-1)![0] as MigrationBackup;
    expect(saved.operation).toBe('add');
    expect(saved.contacts[0].rowChanges).toEqual([
      { op: 'relabel', rowId: 'live-1', value: '7012345', fromLabel: 'mobile', toLabel: 'mobile (old)' },
      { op: 'add', value: '877012345', label: 'mobile', pairedOldValue: '7012345' },
    ]);
  });

  it('labels an unlabelled old row "old" and adds the new row with no label', async () => {
    const { analysis, selected } = await planFor(contactWith([['mobile', '7012345']]));
    mockGetPhones.mockResolvedValue([{ id: 'live-1', label: undefined, number: '7012345' }]);

    await applyMigration({ analysis, selected, operation: 'add' });

    expect(mockPatch).toHaveBeenCalledWith('c1', {
      phones: [
        { id: 'live-1', label: 'old', number: '7012345' },
        { number: '877012345' },
      ],
    });
  });

  it('keeps the +220 form on the added row', async () => {
    const { analysis, selected } = await planFor(contactWith([['mobile', '+220 7012345']]));
    mockGetPhones.mockResolvedValue([
      { id: 'live-1', label: '_$!<Mobile>!$_', number: '+220 7012345' },
    ]);

    await applyMigration({ analysis, selected, operation: 'add' });

    expect(mockPatch).toHaveBeenCalledWith('c1', {
      phones: [
        { id: 'live-1', label: 'mobile (old)', number: '+220 7012345' },
        { label: '_$!<Mobile>!$_', number: '+220 87 701 2345' },
      ],
    });
  });

  it('skips a number that changed since the scan — no write, no failure', async () => {
    const { analysis, selected } = await planFor(contactWith([['mobile', '7012345']]));
    mockGetPhones.mockResolvedValue([{ id: 'live-1', label: '_$!<Mobile>!$_', number: '9990000' }]);

    const result = await applyMigration({ analysis, selected, operation: 'add' });

    expect(mockPatch).not.toHaveBeenCalled();
    expect(result).toMatchObject({ updatedContacts: 0, failures: [] });
    expect(saveBackup).not.toHaveBeenCalled();
  });

  it('is idempotent — a row already marked "(old)" is not double-suffixed', async () => {
    const { analysis, selected } = await planFor(contactWith([['mobile', '7012345']]));
    mockGetPhones.mockResolvedValue([{ id: 'live-1', label: 'mobile (old)', number: '7012345' }]);

    await applyMigration({ analysis, selected, operation: 'add' });

    expect(mockPatch).toHaveBeenCalledWith('c1', {
      phones: [
        { id: 'live-1', label: 'mobile (old)', number: '7012345' },
        { label: 'mobile (old)', number: '877012345' },
      ],
    });
  });
});

describe('undoMigration (operation: add)', () => {
  function addBackup(): MigrationBackup {
    return {
      id: 'mig_add',
      createdAt: '2026-09-04T00:00:00.000Z',
      status: 'applied',
      operation: 'add',
      contacts: [
        {
          contactId: 'c1',
          contactName: 'Awa',
          originalPhones: [{ id: 'p1', label: 'mobile', number: '7012345' }],
          newPhones: [
            { id: 'p1', label: 'mobile (old)', number: '7012345' },
            { label: 'mobile', number: '877012345' },
          ],
          changedPhoneTags: ['p1'],
          rowChanges: [
            { op: 'relabel', rowId: 'p1', value: '7012345', fromLabel: 'mobile', toLabel: 'mobile (old)' },
            { op: 'add', value: '877012345', label: 'mobile', pairedOldValue: '7012345' },
          ],
        },
      ],
    };
  }

  it('removes the added row and restores the old label', async () => {
    mockGetPhones.mockResolvedValue([
      { id: 'live-1', label: 'mobile (old)', number: '7012345' },
      { id: 'live-2', label: '_$!<Mobile>!$_', number: '877012345' },
      { id: 'live-3', label: '_$!<Home>!$_', number: '5550000' }, // user added since
    ]);

    const result = await undoMigration({ backup: addBackup() });

    expect(result).toMatchObject({ restoredContacts: 1, failures: [] });
    expect(mockPatch).toHaveBeenCalledWith('c1', {
      phones: [
        { id: 'live-1', label: '_$!<Mobile>!$_', number: '7012345' },
        { id: 'live-3', number: '5550000' },
      ],
    });
  });

  it('still restores the label when the user already deleted the added row', async () => {
    mockGetPhones.mockResolvedValue([{ id: 'live-1', label: 'mobile (old)', number: '7012345' }]);

    const result = await undoMigration({ backup: addBackup() });

    expect(result.restoredContacts).toBe(1);
    expect(mockPatch).toHaveBeenCalledWith('c1', {
      phones: [{ id: 'live-1', label: '_$!<Mobile>!$_', number: '7012345' }],
    });
  });

  it('does nothing when the user already reverted both changes', async () => {
    mockGetPhones.mockResolvedValue([{ id: 'live-1', label: '_$!<Mobile>!$_', number: '7012345' }]);

    const result = await undoMigration({ backup: addBackup() });

    expect(mockPatch).not.toHaveBeenCalled();
    expect(result.restoredContacts).toBe(0);
    expect(result.failures).toEqual([]);
  });

  it('records a failure when an add backup has no rowChanges', async () => {
    const backup = addBackup();
    backup.contacts[0].rowChanges = [];

    const result = await undoMigration({ backup });

    expect(mockPatch).not.toHaveBeenCalled();
    expect(result.failures).toHaveLength(1);
  });
});
