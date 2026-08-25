'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { bulkApproveMatches, fetchMatches } from '@/lib/libraryApi';
import { MatchLibraryItem } from '@/lib/libraryTypes';

export default function ApprovalQueue() {
  const [items, setItems] = useState<MatchLibraryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetchMatches({
        status: 'pending_admin_approval',
        limit: 100,
        offset: 0,
      });
      setItems(response.items);
      setTotal(response.total);
      setSelectedIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the approval queue.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleApproveSelected() {
    if (selectedIds.length === 0) return;
    setError('');
    setMessage('');
    try {
      const result = await bulkApproveMatches(selectedIds);
      setMessage(`Approved ${result.approved} match(es).`);
      if (result.failed.length > 0) {
        setError(result.failed.map((f) => `Match ${f.id}: ${f.reason}`).join(' · '));
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk approve failed.');
    }
  }

  const allSelected = items.length > 0 && selectedIds.length === items.length;

  return (
    <section
      className="rounded-md border p-4"
      style={{ borderColor: '#E5E3DC', background: '#FFFFFF' }}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-[13px] font-medium" style={{ color: '#080D44' }}>
            High-confidence approval queue
          </h2>
          <p className="text-[11px] mt-1" style={{ color: '#6B6B66' }}>
            Matches scoring 95% or above wait here for an admin. {total.toLocaleString()} pending.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="h-9 px-4 rounded-full text-[12px] font-medium"
            style={{ background: 'transparent', color: '#080D44', border: '1px solid #E5E3DC' }}
          >
            Refresh
          </button>
          <button
            onClick={handleApproveSelected}
            disabled={selectedIds.length === 0}
            className="h-9 px-4 rounded-full text-[12px] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: '#2C6E3F', color: '#F4F3EE' }}
          >
            Approve {selectedIds.length || ''} selected
          </button>
        </div>
      </div>

      {error && (
        <p className="text-[11px] mt-2" style={{ color: '#A12622' }}>
          {error}
        </p>
      )}
      {message && (
        <p className="text-[11px] mt-2" style={{ color: '#2C6E3F' }}>
          {message}
        </p>
      )}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead style={{ background: '#F8F7F4', color: '#6B6B66' }}>
            <tr>
              <th className="text-left px-3 py-2" style={{ width: 32 }}>
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={allSelected}
                  onChange={() => setSelectedIds(allSelected ? [] : items.map((i) => i.id))}
                  disabled={items.length === 0}
                />
              </th>
              <th className="text-left px-3 py-2 font-medium">Entity</th>
              <th className="text-left px-3 py-2 font-medium">Cisco account</th>
              <th className="text-left px-3 py-2 font-medium">Account manager</th>
              <th className="text-left px-3 py-2 font-medium">Score</th>
              <th className="text-left px-3 py-2 font-medium">Staged by</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t" style={{ borderColor: '#F0EEE9' }}>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label={`Select match ${item.id}`}
                    checked={selectedIds.includes(item.id)}
                    onChange={() =>
                      setSelectedIds((prev) =>
                        prev.includes(item.id)
                          ? prev.filter((id) => id !== item.id)
                          : [...prev, item.id]
                      )
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <div style={{ color: '#080D44' }}>{item.entity_name_original}</div>
                  <div className="font-mono text-[10px]" style={{ color: '#6B6B66' }}>
                    {item.entity_name_cleaned}
                    {item.entity_state ? ` · ${item.entity_state}` : ''}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div style={{ color: '#080D44' }}>
                    {item.account?.savm_group_name || item.snap_savm_group_name || '—'}
                  </div>
                  <div className="font-mono text-[10px]" style={{ color: '#6B6B66' }}>
                    {item.savm_group_id || '—'}
                    {item.sfdc_account_name ? ` · ${item.sfdc_account_name}` : ''}
                  </div>
                </td>
                <td className="px-3 py-2" style={{ color: '#6B6B66' }}>
                  {item.am?.am_name || item.am?.am_email || '—'}
                </td>
                <td className="px-3 py-2 font-mono" style={{ color: '#080D44' }}>
                  {item.confidence_score == null
                    ? '—'
                    : `${(item.confidence_score * 100).toFixed(1)}%`}
                </td>
                <td className="px-3 py-2" style={{ color: '#6B6B66' }}>
                  {item.created_by}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center" style={{ color: '#6B6B66' }}>
                  {isLoading ? 'Loading queue…' : 'Nothing waiting for admin approval.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] mt-2" style={{ color: '#6B6B66' }}>
        Need to reject or add notes?{' '}
        <Link href="/workspace/library" className="underline">
          Open the Match Library
        </Link>
        .
      </p>
    </section>
  );
}
