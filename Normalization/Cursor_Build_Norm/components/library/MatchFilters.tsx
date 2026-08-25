'use client';

import { Download, RotateCw, Search } from 'lucide-react';
import { MatchFilters as Filters, MatchStatus, STATUS_LABELS } from '@/lib/libraryTypes';

interface MatchFiltersProps {
  filters: Filters;
  total: number;
  isLoading: boolean;
  onChange: (update: Partial<Filters>) => void;
  onApply: () => void;
  onExport: () => void;
}

const STATUS_OPTIONS: (MatchStatus | '')[] = [
  '',
  'pending_admin_approval',
  'pending_review',
  'active',
  'rejected',
  'deleted',
];

const inputStyle = {
  borderColor: '#E5E3DC',
  color: '#080D44',
  background: '#FFFFFF',
} as const;

export default function MatchFilters({
  filters,
  total,
  isLoading,
  onChange,
  onApply,
  onExport,
}: MatchFiltersProps) {
  return (
    <div
      className="rounded-md border p-3 flex flex-wrap gap-2 items-center"
      style={{ borderColor: '#E5E3DC', background: '#FFFFFF' }}
    >
      <div className="relative">
        <Search
          className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2"
          style={{ color: '#6B6B66' }}
        />
        <input
          value={filters.search ?? ''}
          onChange={(event) => onChange({ search: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onApply();
          }}
          placeholder="Entity, group name, account, group ID"
          className="h-9 pl-8 pr-3 rounded border text-[12px] min-w-[280px]"
          style={inputStyle}
        />
      </div>

      <select
        value={filters.status ?? ''}
        onChange={(event) => onChange({ status: event.target.value as MatchStatus | '' })}
        className="h-9 px-2 rounded border text-[12px]"
        style={inputStyle}
      >
        {STATUS_OPTIONS.map((status) => (
          <option key={status || 'all'} value={status}>
            {status ? STATUS_LABELS[status] : 'All statuses'}
          </option>
        ))}
      </select>

      <select
        value={filters.match_level ?? ''}
        onChange={(event) =>
          onChange({ match_level: event.target.value as Filters['match_level'] })
        }
        className="h-9 px-2 rounded border text-[12px]"
        style={inputStyle}
      >
        <option value="">All match levels</option>
        <option value="SAVM">SAVM group</option>
        <option value="SFDC">SFDC account</option>
      </select>

      <select
        value={filters.link_status ?? ''}
        onChange={(event) =>
          onChange({ link_status: event.target.value as Filters['link_status'] })
        }
        className="h-9 px-2 rounded border text-[12px]"
        style={inputStyle}
      >
        <option value="">Linked and unlinked</option>
        <option value="linked">Linked only</option>
        <option value="unlinked">Unlinked only</option>
      </select>

      <input
        value={filters.state ?? ''}
        onChange={(event) => onChange({ state: event.target.value })}
        placeholder="State"
        className="h-9 px-3 rounded border text-[12px] w-[90px]"
        style={inputStyle}
      />

      <input
        value={filters.vertical ?? ''}
        onChange={(event) => onChange({ vertical: event.target.value })}
        placeholder="Vertical"
        className="h-9 px-3 rounded border text-[12px] w-[120px]"
        style={inputStyle}
      />

      <input
        value={filters.tier ?? ''}
        onChange={(event) => onChange({ tier: event.target.value })}
        placeholder="Tier"
        className="h-9 px-3 rounded border text-[12px] w-[120px]"
        style={inputStyle}
      />

      <button
        onClick={onApply}
        className="h-9 px-4 rounded-full text-[12px] font-medium inline-flex items-center gap-1.5"
        style={{ background: '#080D44', color: '#F4F3EE' }}
      >
        <RotateCw className="w-3.5 h-3.5" />
        Apply
      </button>

      <button
        onClick={onExport}
        className="h-9 px-4 rounded-full text-[12px] font-medium inline-flex items-center gap-1.5"
        style={{ background: 'transparent', color: '#080D44', border: '1px solid #E5E3DC' }}
      >
        <Download className="w-3.5 h-3.5" />
        Export CSV
      </button>

      <span className="text-[11px] ml-auto" style={{ color: '#6B6B66' }}>
        {isLoading ? 'Loading…' : `${total.toLocaleString()} match${total === 1 ? '' : 'es'}`}
      </span>
    </div>
  );
}
