jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { backupToText, migrationBackupSchema } from '../contactBackup';

const legacyBackup = {
  id: 'mig_2026-09-04T00-00-00-000Z',
  createdAt: '2026-09-04T00:00:00.000Z',
  status: 'applied',
  contacts: [
    {
      contactId: 'c1',
      contactName: 'Awa',
      originalPhones: [{ id: 'p1', label: 'mobile', number: '7012345' }],
      newPhones: [{ id: 'p1', label: 'mobile', number: '877012345' }],
      changedPhoneTags: ['p1'],
    },
  ],
};

describe('migrationBackupSchema', () => {
  it('defaults a missing operation to "replace" (pre-feature backups)', () => {
    const parsed = migrationBackupSchema.parse(legacyBackup);
    expect(parsed.operation).toBe('replace');
  });

  it('keeps a valid operation', () => {
    expect(migrationBackupSchema.parse({ ...legacyBackup, operation: 'add' }).operation).toBe('add');
  });

  it('falls back to "replace" for an unknown operation value', () => {
    expect(
      migrationBackupSchema.parse({ ...legacyBackup, operation: 'sideways' }).operation,
    ).toBe('replace');
  });

  it('round-trips the rowChanges discriminated union', () => {
    const withChanges = {
      ...legacyBackup,
      operation: 'add',
      contacts: [
        {
          ...legacyBackup.contacts[0],
          rowChanges: [
            { op: 'relabel', rowId: 'p1', value: '7012345', fromLabel: 'mobile', toLabel: 'mobile (old)' },
            { op: 'add', value: '877012345', label: 'mobile', pairedOldValue: '7012345' },
          ],
        },
      ],
    };
    expect(migrationBackupSchema.parse(withChanges).contacts[0].rowChanges).toHaveLength(2);
  });
});

describe('backupToText', () => {
  it('lists the added number for an "add" backup', () => {
    const text = backupToText(
      migrationBackupSchema.parse({
        ...legacyBackup,
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
      }),
    );
    expect(text).toContain('mobile: 7012345');
    expect(text).toContain('mobile: 877012345  (added)');
  });
});
