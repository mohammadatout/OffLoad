'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { fetchMatchHistory } from '@/lib/libraryApi';
import { MatchHistoryItem } from '@/lib/libraryTypes';

interface MatchHistoryDrawerProps {
  matchId: number | null;
  entityName: string;
  onClose: () => void;
}

function formatFieldChanges(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, { from?: unknown; to?: unknown }>;
    return Object.entries(parsed)
      .map(([field, change]) => `${field}: "${change.from ?? ''}" → "${change.to ?? ''}"`)
      .join(', ');
  } catch {
    return raw;
  }
}

export default function MatchHistoryDrawer({
  matchId,
  entityName,
  onClose,
}: MatchHistoryDrawerProps) {
  const [history, setHistory] = useState<MatchHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (matchId == null) return;

    let isMounted = true;
    setIsLoading(true);
    setError('');

    fetchMatchHistory(matchId)
      .then((rows) => {
        if (isMounted) setHistory(rows);
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load history.');
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [matchId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  if (matchId == null) return null;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <button
        aria-label="Close history"
        onClick={onClose}
        className="absolute inset-0"
        style={{ background: 'rgba(8,13,68,0.25)' }}
      />
      <aside
        className="relative h-full w-full max-w-[440px] overflow-y-auto shadow-xl"
        style={{ background: '#F4F3EE', borderLeft: '1px solid #E5E3DC' }}
      >
        <header
          className="sticky top-0 flex items-start justify-between gap-3 px-4 py-3"
          style={{ background: '#F4F3EE', borderBottom: '1px solid #E5E3DC' }}
        >
          <div className="min-w-0">
            <h2 className="text-[13px] font-medium" style={{ color: '#080D44' }}>
              Audit history
            </h2>
            <p className="text-[11px] truncate" style={{ color: '#6B6B66' }}>
              {entityName} · match {matchId}
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-7 w-7 rounded flex items-center justify-center"
            style={{ border: '1px solid #E5E3DC', background: '#FFFFFF', color: '#6B6B66' }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </header>

        <div className="px-4 py-3">
          {isLoading && (
            <p className="text-[11px]" style={{ color: '#6B6B66' }}>
              Loading history…
            </p>
          )}

          {error && (
            <p className="text-[11px]" style={{ color: '#A12622' }}>
              {error}
            </p>
          )}

          {!isLoading && !error && history.length === 0 && (
            <p className="text-[11px]" style={{ color: '#6B6B66' }}>
              No history recorded yet.
            </p>
          )}

          <ol className="space-y-2">
            {history.map((entry) => {
              const changes = formatFieldChanges(entry.field_changes);
              return (
                <li
                  key={entry.id}
                  className="rounded-md border p-2.5"
                  style={{ borderColor: '#E5E3DC', background: '#FFFFFF' }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium" style={{ color: '#080D44' }}>
                      {entry.event}
                    </span>
                    <span className="text-[10px] font-mono" style={{ color: '#6B6B66' }}>
                      {new Date(entry.created_at).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-[10px] mt-1" style={{ color: '#6B6B66' }}>
                    by {entry.actor}
                    {entry.from_status || entry.to_status
                      ? ` · ${entry.from_status ?? 'new'} → ${entry.to_status ?? '—'}`
                      : ''}
                  </p>

                  {changes && (
                    <p className="text-[10px] mt-1 font-mono" style={{ color: '#6B6B66' }}>
                      {changes}
                    </p>
                  )}

                  {entry.notes && (
                    <p className="text-[11px] mt-1.5" style={{ color: '#080D44' }}>
                      {entry.notes}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </aside>
    </div>
  );
}
