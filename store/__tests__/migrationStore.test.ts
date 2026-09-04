import type { ContactAnalysis } from '@/services/contacts/contactAnalyzer';
import type { MigrationBackup, MigrationResult } from '@/types';

const mockApplyMigration = jest.fn();
const mockUndoMigration = jest.fn();
const mockLoadBackup = jest.fn();
const mockClearBackup = jest.fn().mockResolvedValue(undefined);

jest.mock('@/services/contacts/contactUpdater', () => ({
  applyMigration: (args: unknown) => mockApplyMigration(args),
  undoMigration: (args: unknown) => mockUndoMigration(args),
}));
jest.mock('@/services/contacts/contactBackup', () => ({
  loadBackup: () => mockLoadBackup(),
  clearBackup: () => mockClearBackup(),
}));

import { useMigrationStore } from '../migrationStore';

const analysis = { actionable: [] } as unknown as ContactAnalysis;
const selected = new Set<string>();

const result = (operation: MigrationResult['operation']): MigrationResult => ({
  backupId: 'b1',
  operation,
  updatedContacts: 1,
  updatedNumbers: 1,
  failures: [],
});

const backup = (operation: MigrationBackup['operation']): MigrationBackup => ({
  id: 'b1',
  createdAt: '2026-09-04T00:00:00.000Z',
  status: 'applied',
  operation,
  contacts: [],
});

beforeEach(() => {
  mockApplyMigration.mockReset();
  mockUndoMigration.mockReset();
  mockLoadBackup.mockReset();
  useMigrationStore.getState().reset();
});

it('apply forwards the chosen operation and records it on the result', async () => {
  mockApplyMigration.mockResolvedValue(result('add'));
  mockLoadBackup.mockResolvedValue(backup('add'));

  await useMigrationStore.getState().apply(analysis, selected, 'add');

  expect(mockApplyMigration).toHaveBeenCalledWith(expect.objectContaining({ operation: 'add' }));
  expect(useMigrationStore.getState().result?.operation).toBe('add');
});

it('apply defaults to replace', async () => {
  mockApplyMigration.mockResolvedValue(result('replace'));
  mockLoadBackup.mockResolvedValue(backup('replace'));

  await useMigrationStore.getState().apply(analysis, selected);

  expect(mockApplyMigration).toHaveBeenCalledWith(expect.objectContaining({ operation: 'replace' }));
});

it('retryFailed re-runs in the same operation as the first run', async () => {
  mockApplyMigration.mockResolvedValueOnce({
    ...result('add'),
    failures: [{ contactId: 'c1', contactName: 'A', message: 'x' }],
  });
  mockLoadBackup.mockResolvedValue(backup('add'));
  await useMigrationStore.getState().apply(analysis, selected, 'add');

  mockApplyMigration.mockResolvedValueOnce(result('add'));
  await useMigrationStore.getState().retryFailed(analysis, selected);

  expect(mockApplyMigration).toHaveBeenLastCalledWith(expect.objectContaining({ operation: 'add' }));
});

it('undo passes the stored backup straight through', async () => {
  mockLoadBackup.mockResolvedValue(backup('add'));
  await useMigrationStore.getState().hydrateBackup();

  mockUndoMigration.mockResolvedValue({ restoredContacts: 0, failures: [] });
  await useMigrationStore.getState().undo();

  expect(mockUndoMigration).toHaveBeenCalledWith(expect.objectContaining({ backup: backup('add') }));
});
