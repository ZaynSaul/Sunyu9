import type { MigrationBackup } from '@/types';

jest.mock('expo-file-system', () => ({ File: class {}, Paths: { cache: {} } }));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(false),
  shareAsync: jest.fn(),
}));

import { backupFilename, backupToCsv } from '../backupExport';

const backup: MigrationBackup = {
  id: 'mig_2026-09-04T10-15-00-000Z',
  createdAt: '2026-09-04T10:15:00.000Z',
  status: 'applied',
  operation: 'replace',
  contacts: [
    {
      contactId: 'c1',
      contactName: 'Musa Jallow',
      changedPhoneTags: ['p1'],
      originalPhones: [
        { id: 'p1', label: 'mobile', number: '7123456' },
        { id: 'p2', label: 'work', number: '8491234' },
      ],
      newPhones: [
        { id: 'p1', label: 'mobile', number: '877123456' },
        { id: 'p2', label: 'work', number: '8491234' },
      ],
    },
    {
      contactId: 'c2',
      contactName: 'Fatou, Ceesay',
      changedPhoneTags: ['p3'],
      originalPhones: [{ id: 'p3', label: 'mobile', number: '3123456' }],
      newPhones: [{ id: 'p3', label: 'mobile', number: '833123456' }],
    },
  ],
};

describe('backupToCsv', () => {
  it('emits a header and one row per phone, flagging which changed', () => {
    const lines = backupToCsv(backup).split('\r\n');
    expect(lines[0]).toBe('Contact,Label,Old number,New number,Changed');
    expect(lines[1]).toBe('Musa Jallow,mobile,7123456,877123456,yes');
    expect(lines[2]).toBe('Musa Jallow,work,8491234,8491234,no');
  });

  it('quotes cells containing commas', () => {
    const lines = backupToCsv(backup).split('\r\n');
    expect(lines[3]).toBe('"Fatou, Ceesay",mobile,3123456,833123456,yes');
  });

  it('flags the appended row of an "add" backup', () => {
    const addBackup: MigrationBackup = {
      id: 'mig_add',
      createdAt: '2026-09-04T10:15:00.000Z',
      status: 'applied',
      operation: 'add',
      contacts: [
        {
          contactId: 'c1',
          contactName: 'Musa',
          changedPhoneTags: ['p1'],
          originalPhones: [{ id: 'p1', label: 'mobile', number: '7123456' }],
          newPhones: [
            { id: 'p1', label: 'mobile (old)', number: '7123456' },
            { label: 'mobile', number: '877123456' },
          ],
          rowChanges: [
            { op: 'relabel', rowId: 'p1', value: '7123456', fromLabel: 'mobile', toLabel: 'mobile (old)' },
            { op: 'add', value: '877123456', label: 'mobile', pairedOldValue: '7123456' },
          ],
        },
      ],
    };
    const lines = backupToCsv(addBackup).split('\r\n');
    expect(lines[1]).toBe('Musa,mobile,7123456,7123456,no');
    expect(lines[2]).toBe('Musa,mobile,7123456,877123456,added');
  });
});

describe('backupFilename', () => {
  it('is a readable csv name derived from the batch id', () => {
    expect(backupFilename(backup)).toBe('sunyu9-backup-2026-09-04T10-15-00-000Z.csv');
  });
});
