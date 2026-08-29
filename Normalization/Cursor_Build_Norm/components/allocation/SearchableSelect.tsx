'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';

interface SearchableSelectProps {
  label: string;
  value?: string;
  /** Full option list, for columns small enough to hold in the browser. */
  options?: string[];
  /**
   * Fetch options for a typed query. Supplied for columns with too many
   * distinct values to load, which are searched server-side instead.
   */
  loadOptions?: (query: string, signal: AbortSignal) => Promise<string[]>;
  onChange: (value: string | undefined) => void;
  disabled?: boolean;
  placeholder?: string;
  formatOption?: (option: string) => string;
  minWidth?: number;
}

const PANEL_LIMIT = 300;

/**
 * A dropdown with a search box inside it.
 *
 * Small option lists are filtered in place. Large ones (SAV ID, Unified Acc.
 * Name, Account-SL6) pass `loadOptions` and are queried as the user types, so
 * the browser never has to hold every distinct value.
 */
export default function SearchableSelect({
  label,
  value,
  options,
  loadOptions,
  onChange,
  disabled = false,
  placeholder,
  formatOption,
  minWidth = 190,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isRemote = typeof loadOptions === 'function';

  useEffect(() => {
    if (!isOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
    else setQuery('');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !loadOptions) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setIsLoading(true);
      loadOptions(query, controller.signal)
        .then((next) => setRemote(next))
        .catch(() => {
          if (!controller.signal.aborted) setRemote([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [isOpen, query, loadOptions]);

  const visibleOptions = useMemo(() => {
    if (isRemote) return remote;
    const all = options ?? [];
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? all.filter((option) => option.toLowerCase().includes(needle))
      : all;
    return filtered.slice(0, PANEL_LIMIT);
  }, [isRemote, remote, options, query]);

  const display = value ? (formatOption?.(value) ?? value) : '';

  return (
    <div ref={containerRef} className="relative" style={{ minWidth }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((open) => !open)}
        className="h-9 w-full px-2 rounded border text-[12px] flex items-center gap-1.5 disabled:opacity-50"
        style={{
          borderColor: '#E5E3DC',
          background: '#FFFFFF',
          color: value ? '#080D44' : '#6B6B66',
        }}
        title={display || label}
      >
        <span className="flex-1 text-left truncate">{display || label}</span>
        {value && (
          <X
            className="w-3 h-3 flex-shrink-0"
            style={{ color: '#6B6B66' }}
            onClick={(event) => {
              event.stopPropagation();
              onChange(undefined);
              setIsOpen(false);
            }}
          />
        )}
        <ChevronDown className="w-3 h-3 flex-shrink-0" style={{ color: '#6B6B66' }} />
      </button>

      {isOpen && (
        <div
          className="absolute z-50 mt-1 w-full rounded-md border shadow-lg"
          style={{ borderColor: '#E5E3DC', background: '#FFFFFF' }}
        >
          <div className="p-1.5" style={{ borderBottom: '1px solid #F0EEE9' }}>
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={placeholder ?? `Search ${label.toLowerCase()}…`}
              className="h-8 w-full px-2 rounded border text-[12px]"
              style={{ borderColor: '#E5E3DC', color: '#080D44', background: '#FFFFFF' }}
            />
          </div>

          <div className="max-h-[240px] overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => {
                onChange(undefined);
                setIsOpen(false);
              }}
              className="w-full px-2.5 py-1.5 text-left text-[12px] hover:bg-[#F8F7F4] flex items-center gap-1.5"
              style={{ color: '#6B6B66' }}
            >
              <span className="w-3">{!value && <Check className="w-3 h-3" />}</span>
              All
            </button>

            {isLoading && (
              <p className="px-2.5 py-1.5 text-[11px]" style={{ color: '#6B6B66' }}>
                Searching…
              </p>
            )}

            {!isLoading &&
              visibleOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    onChange(option);
                    setIsOpen(false);
                  }}
                  className="w-full px-2.5 py-1.5 text-left text-[12px] hover:bg-[#F8F7F4] flex items-center gap-1.5"
                  style={{ color: '#080D44' }}
                  title={formatOption?.(option) ?? option}
                >
                  <span className="w-3 flex-shrink-0">
                    {value === option && <Check className="w-3 h-3" />}
                  </span>
                  <span className="truncate">{formatOption?.(option) ?? option}</span>
                </button>
              ))}

            {!isLoading && visibleOptions.length === 0 && (
              <p className="px-2.5 py-1.5 text-[11px]" style={{ color: '#6B6B66' }}>
                {isRemote && !query.trim()
                  ? 'Type to search.'
                  : 'No matching values.'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
