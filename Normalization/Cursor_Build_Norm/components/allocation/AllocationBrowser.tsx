'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Download, RotateCcw, Search } from 'lucide-react';
import GroupDrawer from './GroupDrawer';
import SearchableSelect from './SearchableSelect';
import {
  downloadAccountsWorkbook,
  fetchAccountFacets,
  fetchAccountOptions,
  fetchAccounts,
  fetchAllocationColumns,
} from '@/lib/libraryApi';
import {
  AccountFacets,
  AccountFilters,
  AllocationColumnSettings,
  CiscoAccount,
  SearchableOptionColumn,
} from '@/lib/libraryTypes';
import {
  ALLOCATION_FILTER_ORDER,
  DEFAULT_ALLOCATION_FILTERS,
  HierarchyLevel,
  buildAllocationQueryString,
  clearDescendantLevels,
  isUnfiltered,
  parseAllocationUrlState,
} from '@/lib/allocationFilters';
import {
  MONOSPACE_COLUMNS,
  NUMERIC_COLUMNS,
  SECONDARY_LINE,
  allocationCellValue,
  labelFor,
  verticalLabel,
} from '@/lib/allocationColumns';
const PAGE_SIZE = 50;

/** Columns whose option lists are searched server-side, not preloaded. */
const REMOTE_FILTERS: Partial<Record<string, SearchableOptionColumn>> = {
  sl6: 'sl6',
  savm_group_id: 'savm_group_id',
  unified_account_name: 'unified_account_name',
};

const inputStyle = {
  borderColor: '#E5E3DC',
  color: '#080D44',
  background: '#FFFFFF',
} as const;

interface AllocationBrowserProps {
  onTotalsChange?: (totals: { accounts: number; groups: number } | null) => void;
}

export default function AllocationBrowser({ onTotalsChange }: AllocationBrowserProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [items, setItems] = useState<CiscoAccount[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [draft, setDraft] = useState<AccountFilters>(DEFAULT_ALLOCATION_FILTERS);
  const [applied, setApplied] = useState<AccountFilters>(DEFAULT_ALLOCATION_FILTERS);
  const [facets, setFacets] = useState<AccountFacets | null>(null);
  const [columns, setColumns] = useState<AllocationColumnSettings | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);

  const parseUrlFilters = useCallback(
    () => parseAllocationUrlState(searchParams),
    [searchParams]
  );

  const applyToUrl = useCallback(
    (filters: AccountFilters, nextPage: number) => {
      const queryString = buildAllocationQueryString(filters, nextPage);
      router.replace(queryString ? `${pathname}?${queryString}` : pathname);
    },
    [pathname, router]
  );

  useEffect(() => {
    const parsed = parseUrlFilters();
    setDraft(parsed.filters);
    setApplied(parsed.filters);
    setPage(parsed.page);
    setIsReady(true);
  }, [parseUrlFilters]);

  useEffect(() => {
    fetchAllocationColumns()
      .then(setColumns)
      .catch(() => setColumns(null));
  }, []);

  // Facets follow the applied filters, not the draft: the dropdown lists only
  // need to change once a filter is actually in effect, and the free-text
  // search never changes them at all.
  useEffect(() => {
    const controller = new AbortController();
    fetchAccountFacets({ ...applied, search: undefined }, controller.signal)
      .then((next) => {
        setFacets(next);
        onTotalsChange?.({ accounts: next.total_accounts, groups: next.total_groups });
      })
      .catch(() => {
        if (!controller.signal.aborted) setFacets(null);
      });
    return () => controller.abort();
  }, [applied, onTotalsChange]);

  const loadRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (!isReady) return;
    loadRef.current?.abort();
    const controller = new AbortController();
    loadRef.current = controller;

    setIsLoading(true);
    setError('');
    try {
      const response = await fetchAccounts(
        { ...applied, limit: PAGE_SIZE, offset: page * PAGE_SIZE },
        controller.signal
      );
      setItems(response.items);
      setTotal(response.total);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : 'Failed to load accounts.');
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, [applied, isReady, page]);

  useEffect(() => {
    load();
  }, [load]);

  function commit(nextFilters: AccountFilters) {
    setDraft(nextFilters);
    setApplied(nextFilters);
    setPage(0);
    applyToUrl(nextFilters, 0);
  }

  function applySearch() {
    commit({ ...draft });
  }

  function resetAll() {
    commit({});
  }

  function updateFilter(key: string, value: string | undefined) {
    const base: AccountFilters = { ...draft, [key]: value };
    if (!value) delete base[key as keyof AccountFilters];
    const next = ['sl2', 'sl3', 'sl4', 'sl5'].includes(key)
      ? clearDescendantLevels(base, key as HierarchyLevel)
      : base;
    commit(next);
  }

  async function handleExport() {
    setIsExporting(true);
    setError('');
    setNotice(
      `Building a workbook for ${total.toLocaleString()} rows. ` +
        'Large exports can take up to a minute; the file downloads when it is ready.'
    );
    try {
      const fileName = await downloadAccountsWorkbook(applied);
      setNotice(`Downloaded ${total.toLocaleString()} rows as ${fileName}.`);
    } catch (err) {
      setNotice('');
      setError(err instanceof Error ? err.message : 'Download failed.');
    } finally {
      setIsExporting(false);
    }
  }

  const selectedColumns = columns?.selected ?? [];
  const available = columns?.available ?? [];
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  const showReset = !isUnfiltered(applied);

  const facetOptions = useMemo<Record<string, string[]>>(
    () => ({
      sl2: facets?.sl2 ?? [],
      sl3: facets?.sl3 ?? [],
      sl4: facets?.sl4 ?? [],
      sl5: facets?.sl5 ?? [],
      state: facets?.state ?? [],
      source: facets?.source ?? [],
      tier: facets?.tier ?? [],
      vertical: facets?.vertical ?? [],
    }),
    [facets]
  );

  return (
    <div className="space-y-3">
      <div
        className="rounded-md border p-3"
        style={{ borderColor: '#E5E3DC', background: '#FFFFFF' }}
      >
        <div className="flex flex-wrap items-end gap-2">
          {ALLOCATION_FILTER_ORDER.map(({ key, label }) => {
            const remoteColumn = REMOTE_FILTERS[key];
            return (
              <SearchableSelect
                key={key}
                label={label}
                value={draft[key as keyof AccountFilters] as string | undefined}
                options={remoteColumn ? undefined : facetOptions[key]}
                loadOptions={
                  remoteColumn
                    ? async (query, signal) => {
                        const result = await fetchAccountOptions(
                          remoteColumn,
                          query,
                          { ...draft, [key]: undefined },
                          signal
                        );
                        return result.options;
                      }
                    : undefined
                }
                formatOption={key === 'vertical' ? verticalLabel : undefined}
                onChange={(value) => updateFilter(key, value)}
                minWidth={key === 'unified_account_name' ? 230 : 190}
              />
            );
          })}

          <div className="relative">
            <Search
              className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2"
              style={{ color: '#6B6B66' }}
            />
            <input
              value={draft.search ?? ''}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, search: event.target.value }))
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter') applySearch();
              }}
              placeholder="Free-text search"
              className="h-9 pl-8 pr-3 rounded border text-[12px] min-w-[220px]"
              style={inputStyle}
            />
          </div>

          <button
            onClick={applySearch}
            className="h-9 px-4 rounded-full text-[12px] font-medium"
            style={{ background: '#080D44', color: '#F4F3EE' }}
          >
            Search
          </button>

          {showReset && (
            <button
              onClick={resetAll}
              className="h-9 px-3 rounded-full text-[12px] font-medium inline-flex items-center gap-1"
              style={{
                background: 'transparent',
                color: '#080D44',
                border: '1px solid #E5E3DC',
              }}
              title="Clear every filter"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          )}

          <button
            onClick={handleExport}
            disabled={isExporting || total === 0}
            className="h-9 px-3 rounded-full text-[12px] font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
            style={{
              background: 'transparent',
              color: '#080D44',
              border: '1px solid #E5E3DC',
            }}
            title="Download every row matching the current filters"
          >
            <Download className="w-3 h-3" />
            {isExporting ? 'Preparing…' : 'Download'}
          </button>

          <span className="text-[11px] ml-auto" style={{ color: '#6B6B66' }}>
            {isLoading
              ? 'Loading…'
              : `${total.toLocaleString()} account${total === 1 ? '' : 's'}`}
          </span>
        </div>

        {isUnfiltered(applied) && (
          <p className="text-[10px] mt-2" style={{ color: '#6B6B66' }}>
            Showing every account. Pick any filter to narrow the list; Reset clears
            them all again.
          </p>
        )}
      </div>

      {error && (
        <p className="text-[11px]" style={{ color: '#A12622' }}>
          {error}
        </p>
      )}
      {notice && (
        <p className="text-[11px]" style={{ color: '#2C6E3F' }}>
          {notice}
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
                {selectedColumns.map((key) => (
                  <th
                    key={key}
                    className="text-left px-3 py-2 font-medium whitespace-nowrap"
                  >
                    {labelFor(key, available)}
                  </th>
                ))}
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
                  {selectedColumns.map((key) => {
                    const primary = allocationCellValue(account, key);
                    const secondaryKey = SECONDARY_LINE[key];
                    const secondary = secondaryKey
                      ? allocationCellValue(account, secondaryKey as string)
                      : '';
                    return (
                      <td
                        key={key}
                        className={`px-3 py-2 ${
                          NUMERIC_COLUMNS.has(key) ? 'text-right' : ''
                        }`}
                        style={{ color: '#080D44' }}
                      >
                        <div
                          className={`max-w-[280px] truncate ${
                            MONOSPACE_COLUMNS.has(key) ? 'font-mono' : ''
                          }`}
                          title={primary}
                        >
                          {primary || '—'}
                        </div>
                        {secondary && (
                          <div
                            className="text-[10px] max-w-[280px] truncate"
                            style={{ color: '#6B6B66' }}
                            title={secondary}
                          >
                            {secondary}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {items.length === 0 && (
                <tr>
                  <td
                    colSpan={Math.max(1, selectedColumns.length)}
                    className="px-3 py-6 text-center"
                    style={{ color: '#6B6B66' }}
                  >
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
            {Math.min((page + 1) * PAGE_SIZE, total).toLocaleString()} of{' '}
            {total.toLocaleString()}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const nextPage = Math.max(0, page - 1);
                setPage(nextPage);
                applyToUrl(applied, nextPage);
              }}
              disabled={page === 0}
              className="h-8 px-3 rounded text-[11px] inline-flex items-center gap-1 disabled:opacity-40"
              style={{ border: '1px solid #E5E3DC', color: '#080D44' }}
            >
              <ChevronLeft className="w-3 h-3" />
              Previous
            </button>
            <button
              onClick={() => {
                const nextPage = Math.min(lastPage, page + 1);
                setPage(nextPage);
                applyToUrl(applied, nextPage);
              }}
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
