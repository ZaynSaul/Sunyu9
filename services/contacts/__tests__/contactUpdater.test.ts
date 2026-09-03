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
});

// ── undoMigration ────────────────────────────────────────────────────────────

function makeBackup(overrides: Partial<MigrationBackup['contacts'][number]> = {}): MigrationBackup {
  return {
    id: 'mig_2026-09-04T00-00-00-000Z',
    createdAt: '2026-09-04T00:00:00.000Z',
    status: 'applied',
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
  it('restores the recorded numbers without their stale ids', async () => {
    const result = await undoMigration({ backup: makeBackup() });

    expect(result).toMatchObject({ restoredContacts: 1, failures: [] });
    expect(mockPatch).toHaveBeenCalledWith('c1', {
      phones: [
        { label: '_$!<Mobile>!$_', number: '7012345' },
        { label: '_$!<Work>!$_', number: '4441122' },
      ],
    });
  });

  it('omits the label for an entry recorded without one', async () => {
    await undoMigration({
      backup: makeBackup({
        originalPhones: [
          { id: 'p1', label: 'mobile', number: '7012345' },
          { id: 'p2', number: '5551234' },
        ],
      }),
    });

    expect(mockPatch).toHaveBeenCalledWith('c1', {
      phones: [{ label: '_$!<Mobile>!$_', number: '7012345' }, { number: '5551234' }],
    });
  });

  it('does not wipe a contact whose original phone list was not recorded', async () => {
    const result = await undoMigration({ backup: makeBackup({ originalPhones: [] }) });

    expect(mockPatch).not.toHaveBeenCalled();
    expect(result.restoredContacts).toBe(0);
    expect(result.failures).toHaveLength(1);
  });
});
