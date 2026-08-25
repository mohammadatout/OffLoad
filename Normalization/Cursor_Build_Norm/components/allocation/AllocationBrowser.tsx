'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, Search, X } from 'lucide-react';
import GroupDrawer from './GroupDrawer';
import { fetchAccountFacets, fetchAccounts } from '@/lib/libraryApi';
import { AccountFacets, AccountFilters, CiscoAccount } from '@/lib/libraryTypes';

const PAGE_SIZE = 50;

/**
 * Accounts present in both feeds are the ones with trustworthy coverage, so the
 * page opens filtered to them. The dropdown still exposes the other sources.
 */
export const DEFAULT_SOURCE = 'SAV+SFDC';

const DEFAULT_FILTERS: AccountFilters = { source: DEFAULT_SOURCE };

const inputStyle = {
  borderColor: '#E5E3DC',
  color: '#080D44',
  background: '#FFFFFF',
} as const;

const FACET_FIELDS: { key: keyof AccountFilters; label: string; facet: keyof AccountFacets }[] = [
  { key: 'source', label: 'Source', facet: 'source' },
  { key: 'state', label: 'State', facet: 'state' },
  { key: 'vertical', label: 'Vertical', facet: 'vertical' },
  { key: 'tier', label: 'Tier', facet: 'tier' },
  { key: 'segment', label: 'Segment', facet: 'segment' },
];

export default function AllocationBrowser() {
  const [items, setItems] = useState<CiscoAccount[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [draft, setDraft] = useState<AccountFilters>(DEFAULT_FILTERS);
  const [applied, setApplied] = useState<AccountFilters>(DEFAULT_FILTERS);
  const [facets, setFacets] = useState<AccountFacets | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);

  useEffect(() => {
    fetchAccountFacets()
      .then(setFacets)
      .catch(() => setFacets(null));
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetchAccounts({
        ...applied,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setItems(response.items);
      setTotal(response.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts.');
    } finally {
      setIsLoading(false);
    }
  }, [applied, page]);

  useEffect(() => {
    load();
  }, [load]);

  function apply() {
    setPage(0);
    setApplied(draft);
  }

  function resetToDefault() {
    setDraft(DEFAULT_FILTERS);
    setApplied(DEFAULT_FILTERS);
    setPage(0);
  }

  function clearAll() {
    setDraft({});
    setApplied({});
    setPage(0);
  }

  const isDefaultView =
    applied.source === DEFAULT_SOURCE &&
    !applied.search &&
    !applied.state &&
    !applied.vertical &&
    !applied.tier &&
    !applied.segment;

  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  return (
    <div className="space-y-3">
      <div
        className="rounded-md border p-3"
        style={{ borderColor: '#E5E3DC', background: '#FFFFFF' }}
      >
        <div className="flex flex-wrap items-end gap-2">
          <div className="relative">
            <Search
              className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2"
              style={{ color: '#6B6B66' }}
            />
            <input
              value={draft.search ?? ''}
              onChange={(event) => setDraft((prev) => ({ ...prev, search: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === 'Enter') apply();
              }}
              placeholder="Group name, account name, or SAVM group ID"
              className="h-9 pl-8 pr-3 rounded border text-[12px] min-w-[300px]"
              style={inputStyle}
            />
          </div>

          {FACET_FIELDS.map((field) => {
            const options = (facets?.[field.facet] as string[] | undefined) ?? [];
            return (
              <select
                key={field.key as string}
                value={(draft[field.key] as string) ?? ''}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, [field.key]: event.target.value }))
                }
                className="h-9 px-2 rounded border text-[12px] max-w-[170px]"
                style={inputStyle}
              >
                <option value="">All {field.label.toLowerCase()}s</option>
                {options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            );
          })}

          <button
            onClick={apply}
            className="h-9 px-4 rounded-full text-[12px] font-medium"
            style={{ background: '#080D44', color: '#F4F3EE' }}
          >
            Search
          </button>

          {!isDefaultView && (
            <button
              onClick={resetToDefault}
              className="h-9 px-3 rounded-full text-[12px] font-medium inline-flex items-center gap-1"
              style={{ background: 'transparent', color: '#080D44', border: '1px solid #E5E3DC' }}
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          )}

          <button
            onClick={clearAll}
            className="h-9 px-3 rounded-full text-[12px] font-medium inline-flex items-center gap-1"
            style={{ background: 'transparent', color: '#6B6B66', border: '1px solid #E5E3DC' }}
          >
            <X className="w-3 h-3" />
            Show all sources
          </button>

          <span className="text-[11px] ml-auto" style={{ color: '#6B6B66' }}>
            {isLoading
              ? 'Loading…'
              : `${total.toLocaleString()} account${total === 1 ? '' : 's'}`}
          </span>
        </div>

        {isDefaultView && (
          <p className="text-[10px] mt-2" style={{ color: '#6B6B66' }}>
            Showing <strong>{DEFAULT_SOURCE}</strong> accounts only — those present in both the SAVM
            coverage table and SFDC. Change the Source filter to see the rest.
          </p>
        )}
      </div>

      {error && (
        <p className="text-[11px]" style={{ color: '#A12622' }}>
          {error}
        </p>
      )}

      <div
        className="rounded-md border overflow-hidden"
        style={{ borderColor: '#E5E3DC', background: '#FFFFFF' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead style={{ background: '#F8F7F4', color: '#6B6B66' }}>
              <tr>
                <th className="text-left px-3 py-2 font-medium whitespace-nowrap">SAVM group</th>
                <th className="text-left px-3 py-2 font-medium whitespace-nowrap">SFDC account</th>
                <th className="text-left px-3 py-2 font-medium whitespace-nowrap">State</th>
                <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Vertical</th>
                <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Tier</th>
                <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Source</th>
                <th className="text-left px-3 py-2 font-medium whitespace-nowrap">
                  Nominated account executive
                </th>
                <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Confidence</th>
                <th className="text-left px-3 py-2 font-medium whitespace-nowrap">
                  Sales hierarchy
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((account) => (
                <tr
                  key={account.id}
                  onClick={() => setOpenGroupId(account.savm_group_id)}
                  className="border-t cursor-pointer hover:bg-[#FBFAF7]"
                  style={{ borderColor: '#F0EEE9' }}
                >
                  <td className="px-3 py-2">
                    <div style={{ color: '#080D44' }}>{account.savm_group_name || '—'}</div>
                    <div className="font-mono text-[10px]" style={{ color: '#6B6B66' }}>
                      {account.savm_group_id}
                    </div>
                  </td>
                  <td className="px-3 py-2" style={{ color: '#080D44' }}>
                    {account.sfdc_account_name || '—'}
                  </td>
                  <td className="px-3 py-2" style={{ color: '#6B6B66' }}>
                    {account.state || '—'}
                  </td>
                  <td className="px-3 py-2" style={{ color: '#6B6B66' }}>
                    {account.vertical || '—'}
                  </td>
                  <td className="px-3 py-2" style={{ color: '#6B6B66' }}>
                    {account.tier || '—'}
                  </td>
                  <td className="px-3 py-2" style={{ color: '#6B6B66' }}>
                    {account.source || '—'}
                  </td>
                  <td className="px-3 py-2">
                    <div style={{ color: '#080D44' }}>{account.am_name || '—'}</div>
                    <div className="text-[10px]" style={{ color: '#6B6B66' }}>
                      {account.am_email || ''}
                    </div>
                  </td>
                  <td className="px-3 py-2" style={{ color: '#6B6B66' }}>
                    <div>{account.am_confidence || '—'}</div>
                    <div className="text-[10px] font-mono">
                      {account.am_priority != null ? `priority ${account.am_priority}` : ''}
                    </div>
                  </td>
                  <td className="px-3 py-2" style={{ color: '#6B6B66' }}>
                    <div
                      className="text-[10px] max-w-[240px] truncate"
                      title={[
                        account.sl1,
                        account.sl2,
                        account.sl3,
                        account.sl4,
                        account.sl5,
                        account.sl6,
                      ]
                        .filter(Boolean)
                        .join(' › ')}
                    >
                      {[account.sl1, account.sl2, account.sl3].filter(Boolean).join(' › ') || '—'}
                    </div>
                  </td>
                </tr>
              ))}

              {items.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center" style={{ color: '#6B6B66' }}>
                    {isLoading
                      ? 'Loading accounts…'
                      : 'No accounts match. An admin can import the reference file from the Admin tab.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <span className="text-[11px]" style={{ color: '#6B6B66' }}>
            Showing {(page * PAGE_SIZE + 1).toLocaleString()}–
            {Math.min((page + 1) * PAGE_SIZE, total).toLocaleString()} of {total.toLocaleString()}
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

      <GroupDrawer savmGroupId={openGroupId} onClose={() => setOpenGroupId(null)} />
    </div>
  );
}
