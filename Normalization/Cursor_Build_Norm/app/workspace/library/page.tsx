'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import DecisionModal, { DecisionKind } from '@/components/library/DecisionModal';
import MatchFilters from '@/components/library/MatchFilters';
import MatchHistoryDrawer from '@/components/library/MatchHistoryDrawer';
import MatchLibraryTable from '@/components/library/MatchLibraryTable';
import { getMe } from '@/lib/authApi';
import {
  approveMatch,
  bulkApproveMatches,
  deleteMatch,
  downloadMatchExport,
  fetchMatches,
  rejectMatch,
  restoreMatch,
  updateMatchNotes,
} from '@/lib/libraryApi';
import { MatchFilters as Filters, MatchLibraryItem } from '@/lib/libraryTypes';

const PAGE_SIZE = 50;

export default function LibraryPage() {
  const [items, setItems] = useState<MatchLibraryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<Filters>({ limit: PAGE_SIZE, offset: 0 });
  const [appliedFilters, setAppliedFilters] = useState<Filters>({ limit: PAGE_SIZE, offset: 0 });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [historyItem, setHistoryItem] = useState<MatchLibraryItem | null>(null);
  const [decision, setDecision] = useState<{ kind: DecisionKind; item: MatchLibraryItem } | null>(
    null
  );

  useEffect(() => {
    getMe()
      .then((me) => setIsAdmin(me.role === 'admin'))
      .catch(() => setIsAdmin(false));
  }, []);

  const loadMatches = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetchMatches({
        ...appliedFilters,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setItems(response.items);
      setTotal(response.total);
      setNoteDrafts(
        response.items.reduce<Record<number, string>>((acc, item) => {
          acc[item.id] = item.notes || '';
          return acc;
        }, {})
      );
      setSelectedIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the match library.');
    } finally {
      setIsLoading(false);
    }
  }, [appliedFilters, page]);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  function handleFilterChange(update: Partial<Filters>) {
    setFilters((prev) => ({ ...prev, ...update }));
  }

  function handleApplyFilters() {
    setPage(0);
    setAppliedFilters(filters);
  }

  async function withBusy(matchId: number, action: () => Promise<string>) {
    setBusyId(matchId);
    setError('');
    setMessage('');
    try {
      setMessage(await action());
      await loadMatches();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The action failed.');
    } finally {
      setBusyId(null);
    }
  }

  function handleSaveNote(item: MatchLibraryItem) {
    const notes = noteDrafts[item.id] ?? '';
    return withBusy(item.id, async () => {
      await updateMatchNotes(item.id, notes);
      return `Notes saved for ${item.entity_name_original}.`;
    });
  }

  function handleRestore(item: MatchLibraryItem) {
    return withBusy(item.id, async () => {
      const restored = await restoreMatch(item.id);
      return `Restored ${item.entity_name_original} to ${restored.status}.`;
    });
  }

  async function handleConfirmDecision(notes: string) {
    if (!decision) return;
    const { kind, item } = decision;

    await withBusy(item.id, async () => {
      if (kind === 'approve') {
        await approveMatch(item.id, notes || undefined);
        return `Approved ${item.entity_name_original}. Future runs will resolve it from the library.`;
      }
      if (kind === 'reject') {
        await rejectMatch(item.id, notes);
        return `Rejected ${item.entity_name_original}. It will not be suggested again.`;
      }
      await deleteMatch(item.id, notes);
      return `Deleted ${item.entity_name_original}. It can be restored from this page.`;
    });

    setDecision(null);
  }

  async function handleBulkApprove() {
    if (selectedIds.length === 0) return;
    setError('');
    setMessage('');
    setIsLoading(true);
    try {
      const result = await bulkApproveMatches(selectedIds);
      const failedNote =
        result.failed.length > 0 ? ` ${result.failed.length} could not be approved.` : '';
      setMessage(`Approved ${result.approved} match(es).${failedNote}`);
      if (result.failed.length > 0) {
        setError(result.failed.map((f) => `Match ${f.id}: ${f.reason}`).join(' · '));
      }
      await loadMatches();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk approve failed.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleExport() {
    setError('');
    try {
      const blob = await downloadMatchExport({ ...appliedFilters, limit: 200 });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'match_library_export.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    }
  }

  function toggleSelect(matchId: number) {
    setSelectedIds((prev) =>
      prev.includes(matchId) ? prev.filter((id) => id !== matchId) : [...prev, matchId]
    );
  }

  function toggleSelectAll() {
    const selectable = items
      .filter((i) => i.status === 'pending_admin_approval' || i.status === 'pending_review')
      .map((i) => i.id);
    setSelectedIds((prev) => (selectable.every((id) => prev.includes(id)) ? [] : selectable));
  }

  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1600px] mx-auto px-phi-3 py-phi-3 space-y-3">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-[16px] font-medium" style={{ color: '#080D44' }}>
              Match Library
            </h1>
            <p className="text-[12px] mt-1" style={{ color: '#6B6B66' }}>
              Every approved match is remembered, so later runs resolve it instantly instead of
              scoring it again.
            </p>
          </div>

          {selectedIds.length > 0 && isAdmin && (
            <button
              onClick={handleBulkApprove}
              className="h-9 px-4 rounded-full text-[12px] font-medium"
              style={{ background: '#2C6E3F', color: '#F4F3EE' }}
            >
              Approve {selectedIds.length} selected
            </button>
          )}
        </div>

        <MatchFilters
          filters={filters}
          total={total}
          isLoading={isLoading}
          onChange={handleFilterChange}
          onApply={handleApplyFilters}
          onExport={handleExport}
        />

        {error && (
          <p className="text-[11px]" style={{ color: '#A12622' }}>
            {error}
          </p>
        )}
        {message && (
          <p className="text-[11px]" style={{ color: '#2C6E3F' }}>
            {message}
          </p>
        )}

        <MatchLibraryTable
          items={items}
          isLoading={isLoading}
          isAdmin={isAdmin}
          busyId={busyId}
          selectedIds={selectedIds}
          noteDrafts={noteDrafts}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onNoteChange={(matchId, notes) =>
            setNoteDrafts((prev) => ({ ...prev, [matchId]: notes }))
          }
          onSaveNote={handleSaveNote}
          onApprove={(item) => setDecision({ kind: 'approve', item })}
          onReject={(item) => setDecision({ kind: 'reject', item })}
          onDelete={(item) => setDecision({ kind: 'delete', item })}
          onRestore={handleRestore}
          onHistory={setHistoryItem}
        />

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between">
            <span className="text-[11px]" style={{ color: '#6B6B66' }}>
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of{' '}
              {total.toLocaleString()}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="h-8 px-3 rounded text-[11px] inline-flex items-center gap-1 disabled:opacity-40"
                style={{ border: '1px solid #E5E3DC', color: '#080D44' }}
              >
                <ChevronLeft className="w-3 h-3" />
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                disabled={page >= lastPage}
                className="h-8 px-3 rounded text-[11px] inline-flex items-center gap-1 disabled:opacity-40"
                style={{ border: '1px solid #E5E3DC', color: '#080D44' }}
              >
                Next
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      <MatchHistoryDrawer
        matchId={historyItem?.id ?? null}
        entityName={historyItem?.entity_name_original ?? ''}
        onClose={() => setHistoryItem(null)}
      />

      <DecisionModal
        kind={decision?.kind ?? null}
        entityName={decision?.item.entity_name_original ?? ''}
        isSaving={busyId !== null}
        onCancel={() => setDecision(null)}
        onConfirm={handleConfirmDecision}
      />
    </div>
  );
}
