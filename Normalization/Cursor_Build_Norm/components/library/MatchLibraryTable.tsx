'use client';

import { AlertTriangle, History, Link2Off, RotateCcw } from 'lucide-react';
import { MatchLibraryItem } from '@/lib/libraryTypes';
import StatusBadge from './StatusBadge';

interface MatchLibraryTableProps {
  items: MatchLibraryItem[];
  isLoading: boolean;
  isAdmin: boolean;
  busyId: number | null;
  selectedIds: number[];
  noteDrafts: Record<number, string>;
  onToggleSelect: (matchId: number) => void;
  onToggleSelectAll: () => void;
  onNoteChange: (matchId: number, notes: string) => void;
  onSaveNote: (item: MatchLibraryItem) => void;
  onApprove: (item: MatchLibraryItem) => void;
  onReject: (item: MatchLibraryItem) => void;
  onDelete: (item: MatchLibraryItem) => void;
  onRestore: (item: MatchLibraryItem) => void;
  onHistory: (item: MatchLibraryItem) => void;
}

const CELL = 'px-3 py-2 align-top';
const HEAD = 'text-left px-3 py-2 font-medium whitespace-nowrap';

function formatScore(score: number | null): string {
  if (score == null) return '—';
  return `${(Number(score) * 100).toFixed(1)}%`;
}

function selectableStatuses(item: MatchLibraryItem): boolean {
  return item.status === 'pending_admin_approval' || item.status === 'pending_review';
}

export default function MatchLibraryTable({
  items,
  isLoading,
  isAdmin,
  busyId,
  selectedIds,
  noteDrafts,
  onToggleSelect,
  onToggleSelectAll,
  onNoteChange,
  onSaveNote,
  onApprove,
  onReject,
  onDelete,
  onRestore,
  onHistory,
}: MatchLibraryTableProps) {
  const selectable = items.filter(selectableStatuses);
  const allSelected = selectable.length > 0 && selectable.every((i) => selectedIds.includes(i.id));

  return (
    <div
      className="rounded-md border overflow-hidden"
      style={{ borderColor: '#E5E3DC', background: '#FFFFFF' }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead style={{ background: '#F8F7F4', color: '#6B6B66' }}>
            <tr>
              <th className={HEAD} style={{ width: 32 }}>
                <input
                  type="checkbox"
                  aria-label="Select all pending matches"
                  checked={allSelected}
                  onChange={onToggleSelectAll}
                  disabled={selectable.length === 0}
                />
              </th>
              <th className={HEAD}>Entity</th>
              <th className={HEAD}>Cisco account</th>
              <th className={HEAD}>Level</th>
              <th className={HEAD}>Account manager</th>
              <th className={HEAD}>Vertical / Tier</th>
              <th className={HEAD}>Score</th>
              <th className={HEAD}>Status</th>
              <th className={HEAD}>Provenance</th>
              <th className={HEAD} style={{ minWidth: 220 }}>
                Notes
              </th>
              <th className={HEAD}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const isBusy = busyId === item.id;
              const account = item.account;
              const am = item.am;

              return (
                <tr key={item.id} className="border-t" style={{ borderColor: '#F0EEE9' }}>
                  <td className={CELL}>
                    {selectableStatuses(item) && (
                      <input
                        type="checkbox"
                        aria-label={`Select match ${item.id}`}
                        checked={selectedIds.includes(item.id)}
                        onChange={() => onToggleSelect(item.id)}
                      />
                    )}
                  </td>

                  <td className={CELL}>
                    <div style={{ color: '#080D44' }}>{item.entity_name_original}</div>
                    <div className="font-mono text-[10px]" style={{ color: '#6B6B66' }}>
                      {item.entity_name_cleaned}
                      {item.entity_state ? ` · ${item.entity_state}` : ''}
                    </div>
                  </td>

                  <td className={CELL}>
                    <div style={{ color: '#080D44' }}>
                      {account?.savm_group_name || item.snap_savm_group_name || '—'}
                    </div>
                    <div className="font-mono text-[10px]" style={{ color: '#6B6B66' }}>
                      {item.savm_group_id || '—'}
                    </div>
                    {item.sfdc_account_name && (
                      <div className="text-[10px] mt-0.5" style={{ color: '#6B6B66' }}>
                        {item.sfdc_account_name}
                        {item.account_state ? ` · ${item.account_state}` : ''}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.link_status === 'unlinked' && (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px]"
                          style={{ background: '#FBEDEC', color: '#A12622', border: '1px solid #EBC7C4' }}
                          title="The SAVM group is missing from the latest reference import"
                        >
                          <Link2Off className="w-2.5 h-2.5" />
                          Unlinked
                        </span>
                      )}
                      {item.drifted && (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px]"
                          style={{ background: '#FDF8E8', color: '#8A6A08', border: '1px solid #E5D5A0' }}
                          title="Reference data changed since this match was approved"
                        >
                          <AlertTriangle className="w-2.5 h-2.5" />
                          Drifted
                        </span>
                      )}
                    </div>
                  </td>

                  <td className={CELL} style={{ color: '#6B6B66' }}>
                    {item.match_level || '—'}
                  </td>

                  <td className={CELL}>
                    <div style={{ color: '#080D44' }}>{am?.am_name || am?.am_email || '—'}</div>
                    {am?.am_confidence && (
                      <div className="text-[10px]" style={{ color: '#6B6B66' }}>
                        {am.am_confidence}
                        {am.am_priority != null ? ` · priority ${am.am_priority}` : ''}
                      </div>
                    )}
                    {am?.am_source_account_name && item.match_level === 'SAVM' && (
                      <div className="text-[10px]" style={{ color: '#6B6B66' }}>
                        via {am.am_source_account_name}
                      </div>
                    )}
                  </td>

                  <td className={CELL} style={{ color: '#6B6B66' }}>
                    <div>{account?.vertical || '—'}</div>
                    <div className="text-[10px]">{account?.tier || ''}</div>
                  </td>

                  <td className={CELL}>
                    <div className="font-mono" style={{ color: '#080D44' }}>
                      {formatScore(item.confidence_score)}
                    </div>
                    <div className="text-[10px]" style={{ color: '#6B6B66' }}>
                      {item.match_stage || ''}
                    </div>
                  </td>

                  <td className={CELL}>
                    <StatusBadge status={item.status} />
                  </td>

                  <td className={CELL} style={{ color: '#6B6B66' }}>
                    <div className="text-[10px]">{item.source}</div>
                    {item.source_detail && (
                      <div className="text-[10px] font-mono truncate max-w-[140px]" title={item.source_detail}>
                        {item.source_detail}
                      </div>
                    )}
                    <div className="text-[10px] mt-0.5">
                      {item.created_by} · {new Date(item.created_at).toLocaleDateString()}
                    </div>
                    {item.decided_by && (
                      <div className="text-[10px]">decided by {item.decided_by}</div>
                    )}
                  </td>

                  <td className={CELL}>
                    <textarea
                      value={noteDrafts[item.id] ?? ''}
                      onChange={(event) => onNoteChange(item.id, event.target.value)}
                      rows={2}
                      className="w-full rounded border px-2 py-1.5 text-[11px]"
                      style={{ borderColor: '#E5E3DC', color: '#080D44' }}
                    />
                    {(noteDrafts[item.id] ?? '') !== (item.notes ?? '') && (
                      <button
                        onClick={() => onSaveNote(item)}
                        disabled={isBusy}
                        className="mt-1 h-6 px-2 rounded text-[10px] disabled:opacity-50"
                        style={{ border: '1px solid #E5E3DC', color: '#080D44' }}
                      >
                        Save note
                      </button>
                    )}
                  </td>

                  <td className={CELL}>
                    <div className="flex flex-col gap-1">
                      {item.status !== 'active' && item.status !== 'deleted' && (
                        <button
                          onClick={() => onApprove(item)}
                          disabled={isBusy}
                          className="h-6 px-2 rounded text-[10px] disabled:opacity-50"
                          style={{ border: '1px solid #C3E0CC', color: '#2C6E3F' }}
                        >
                          Approve
                        </button>
                      )}
                      {item.status !== 'rejected' && item.status !== 'deleted' && (
                        <button
                          onClick={() => onReject(item)}
                          disabled={isBusy}
                          className="h-6 px-2 rounded text-[10px] disabled:opacity-50"
                          style={{ border: '1px solid #EBC7C4', color: '#A12622' }}
                        >
                          Reject
                        </button>
                      )}
                      {isAdmin && item.status !== 'deleted' && (
                        <button
                          onClick={() => onDelete(item)}
                          disabled={isBusy}
                          className="h-6 px-2 rounded text-[10px] disabled:opacity-50"
                          style={{ border: '1px solid #E5E3DC', color: '#6B6B66' }}
                        >
                          Delete
                        </button>
                      )}
                      {isAdmin && item.status === 'deleted' && (
                        <button
                          onClick={() => onRestore(item)}
                          disabled={isBusy}
                          className="h-6 px-2 rounded text-[10px] inline-flex items-center gap-1 disabled:opacity-50"
                          style={{ border: '1px solid #E5E3DC', color: '#080D44' }}
                        >
                          <RotateCcw className="w-2.5 h-2.5" />
                          Restore
                        </button>
                      )}
                      <button
                        onClick={() => onHistory(item)}
                        className="h-6 px-2 rounded text-[10px] inline-flex items-center gap-1"
                        style={{ border: '1px solid #E5E3DC', color: '#6B6B66' }}
                      >
                        <History className="w-2.5 h-2.5" />
                        History
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {items.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-6 text-center" style={{ color: '#6B6B66' }}>
                  {isLoading ? 'Loading matches…' : 'No matches for the current filter.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
