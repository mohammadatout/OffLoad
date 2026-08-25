'use client';

import { useState } from 'react';
import { DatabaseBackup } from 'lucide-react';
import ApprovalQueue from '@/components/admin/ApprovalQueue';
import CsvImportPanel from '@/components/admin/CsvImportPanel';
import UserManager from '@/components/admin/UserManager';
import {
  createBackup,
  uploadAccountImport,
  uploadBulkDeletionImport,
  uploadBulkMatchImport,
} from '@/lib/libraryApi';

export default function AdminPage() {
  const [backupMessage, setBackupMessage] = useState('');
  const [backupError, setBackupError] = useState('');
  const [isBackingUp, setIsBackingUp] = useState(false);

  async function handleBackup() {
    setBackupError('');
    setBackupMessage('');
    setIsBackingUp(true);
    try {
      const result = await createBackup();
      setBackupMessage(`Wrote ${result.backup_file} to Matching_Engine/backups.`);
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : 'Backup failed.');
    } finally {
      setIsBackingUp(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1400px] mx-auto px-phi-3 py-phi-3 space-y-4">
        <div>
          <h1 className="text-[16px] font-medium" style={{ color: '#080D44' }}>
            Admin
          </h1>
          <p className="text-[12px] mt-1" style={{ color: '#6B6B66' }}>
            Clear the high-confidence queue, manage users, and refresh the Cisco account reference.
          </p>
        </div>

        <ApprovalQueue />

        <CsvImportPanel
          title="Import Cisco account reference"
          description="Upload the SQL export of all Cisco accounts and nominated account executives. This replaces the reference table: rows absent from the file are deactivated, and matches whose SAVM group disappears are flagged unlinked rather than deleted. Browse the result on the AE Allocation tab."
          requiredColumns={['SAVM_ID']}
          buttonLabel="Import reference file"
          resultTitle="Reference import result"
          upload={uploadAccountImport}
        />

        <CsvImportPanel
          title="Historical matches"
          description="Import matches that were already approved elsewhere. Rows land as active immediately. Reference a SAVM group alone for a group-level match, or add the account name for an SFDC-level match."
          requiredColumns={[
            'entity_name_original',
            'entity_name_cleaned',
            'savm_group_id',
          ]}
          buttonLabel="Import historical matches"
          resultTitle="Historical match import result"
          upload={uploadBulkMatchImport}
        />

        <CsvImportPanel
          title="Bulk deletions"
          description="Soft-delete matches in bulk. Identify each row by match_id, or by entity_name_cleaned plus savm_group_id. Deleted matches are retained and can be restored from the Match Library."
          requiredColumns={['match_id  — or —  entity_name_cleaned + savm_group_id']}
          buttonLabel="Import deletions"
          resultTitle="Deletion import result"
          upload={uploadBulkDeletionImport}
        />

        <UserManager />

        <section
          className="rounded-md border p-4"
          style={{ borderColor: '#E5E3DC', background: '#FFFFFF' }}
        >
          <h2 className="text-[13px] font-medium" style={{ color: '#080D44' }}>
            Database backup
          </h2>
          <p className="text-[11px] mt-1" style={{ color: '#6B6B66' }}>
            Writes a timestamped copy of the SQLite database into Matching_Engine/backups.
          </p>

          {backupError && (
            <p className="text-[11px] mt-2" style={{ color: '#A12622' }}>
              {backupError}
            </p>
          )}
          {backupMessage && (
            <p className="text-[11px] mt-2" style={{ color: '#2C6E3F' }}>
              {backupMessage}
            </p>
          )}

          <button
            onClick={handleBackup}
            disabled={isBackingUp}
            className="mt-3 h-9 px-4 rounded-full text-[12px] font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
            style={{ background: '#080D44', color: '#F4F3EE' }}
          >
            <DatabaseBackup className="w-3.5 h-3.5" />
            {isBackingUp ? 'Backing up…' : 'Create backup'}
          </button>
        </section>
      </div>
    </div>
  );
}
