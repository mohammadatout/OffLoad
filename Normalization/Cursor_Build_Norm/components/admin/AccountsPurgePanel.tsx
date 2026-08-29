'use client';

import { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { downloadAccountsWorkbook, purgeAccounts } from '@/lib/libraryApi';

type Phase = 'idle' | 'exported';

const CONFIRM_WORD = 'DELETE';

/**
 * Empty the AE Allocation reference table.
 *
 * Downloads every row first and only then asks for confirmation, so the
 * irreversible step always happens after a copy has left the building. Matches
 * are never deleted by this: they are flagged unlinked and re-link if the
 * reference comes back.
 */
export default function AccountsPurgePanel() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [confirmText, setConfirmText] = useState('');
  const [exportedFile, setExportedFile] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');

  async function exportThenArm() {
    setIsWorking(true);
    setError('');
    setResult('');
    try {
      // include_inactive because the purge deletes every row, so a backup that
      // covered only the active ones would not be a backup. '*' asks for every
      // column, making the front sheet alone a complete copy.
      const fileName = await downloadAccountsWorkbook(
        {},
        { includeInactive: true, columns: ['*'] }
      );
      setExportedFile(fileName);
      setPhase('exported');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed; nothing was deleted.');
    } finally {
      setIsWorking(false);
    }
  }

  async function confirmPurge() {
    setIsWorking(true);
    setError('');
    try {
      const purged = await purgeAccounts(confirmText.trim());
      setResult(
        `Deleted ${purged.deleted.toLocaleString()} reference rows. ` +
          `${purged.newly_unlinked.toLocaleString()} match${
            purged.newly_unlinked === 1 ? '' : 'es'
          } flagged unlinked, none deleted.`
      );
      setPhase('idle');
      setConfirmText('');
      setExportedFile('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setIsWorking(false);
    }
  }

  function cancel() {
    setPhase('idle');
    setConfirmText('');
    setError('');
  }

  return (
    <section
      className="rounded-md border p-4"
      style={{ borderColor: '#E5D3D0', background: '#FFFFFF' }}
    >
      <h2
        className="text-[13px] font-medium inline-flex items-center gap-1.5"
        style={{ color: '#A12622' }}
      >
        <AlertTriangle className="w-3.5 h-3.5" />
        Empty the AE Allocation reference
      </h2>
      <p className="text-[11px] mt-1" style={{ color: '#6B6B66' }}>
        Downloads every account to Excel first, then permanently deletes the whole reference
        table. Approved matches are kept and flagged unlinked, and they re-link automatically
        if you import the reference again.
      </p>

      {error && (
        <p className="text-[11px] mt-2" style={{ color: '#A12622' }}>
          {error}
        </p>
      )}
      {result && (
        <p className="text-[11px] mt-2" style={{ color: '#2C6E3F' }}>
          {result}
        </p>
      )}

      {phase === 'idle' && (
        <button
          onClick={exportThenArm}
          disabled={isWorking}
          className="mt-3 h-9 px-4 rounded-full text-[12px] font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
          style={{ background: '#A12622', color: '#FFFFFF' }}
        >
          <Trash2 className="w-3.5 h-3.5" />
          {isWorking
            ? 'Building backup workbook…'
            : 'Download backup and empty table'}
        </button>
      )}

      {isWorking && phase === 'idle' && (
        <p className="text-[10px] mt-2" style={{ color: '#6B6B66' }}>
          A full reference export is a few hundred thousand rows and can take a minute.
          Nothing is deleted until you confirm.
        </p>
      )}

      {phase === 'exported' && (
        <div
          className="mt-3 rounded border p-3"
          style={{ borderColor: '#E5D3D0', background: '#FDF7F6' }}
        >
          <p className="text-[11px]" style={{ color: '#080D44' }}>
            {exportedFile ? (
              <>
                Saved every row, active and inactive, to{' '}
                <span className="font-mono">{exportedFile}</span>. Open the file and check it
                before continuing.
              </>
            ) : (
              'No backup file was produced.'
            )}
          </p>
          <p className="text-[11px] mt-2" style={{ color: '#A12622' }}>
            This permanently deletes every reference row and cannot be undone. Type{' '}
            <strong>{CONFIRM_WORD}</strong> to confirm.
          </p>

          <div className="mt-2 flex items-center gap-2">
            <input
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder={CONFIRM_WORD}
              className="h-9 px-2 rounded border text-[12px] font-mono w-[140px]"
              style={{ borderColor: '#E5D3D0', color: '#080D44', background: '#FFFFFF' }}
            />
            <button
              onClick={confirmPurge}
              disabled={isWorking || confirmText.trim() !== CONFIRM_WORD}
              className="h-9 px-4 rounded-full text-[12px] font-medium disabled:opacity-40"
              style={{ background: '#A12622', color: '#FFFFFF' }}
            >
              {isWorking ? 'Deleting…' : 'Permanently delete'}
            </button>
            <button
              onClick={cancel}
              disabled={isWorking}
              className="h-9 px-3 rounded-full text-[12px] font-medium disabled:opacity-50"
              style={{ background: 'transparent', color: '#6B6B66', border: '1px solid #E5E3DC' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
