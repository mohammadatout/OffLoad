'use client';

import { useEffect, useState } from 'react';
import { Star, X } from 'lucide-react';
import { fetchGroup } from '@/lib/libraryApi';
import { GroupSummary } from '@/lib/libraryTypes';

interface GroupDrawerProps {
  savmGroupId: string | null;
  onClose: () => void;
}

export default function GroupDrawer({ savmGroupId, onClose }: GroupDrawerProps) {
  const [group, setGroup] = useState<GroupSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!savmGroupId) return;

    let isMounted = true;
    setIsLoading(true);
    setError('');
    setGroup(null);

    fetchGroup(savmGroupId)
      .then((data) => {
        if (isMounted) setGroup(data);
      })
      .catch((err: unknown) => {
        if (isMounted) setError(err instanceof Error ? err.message : 'Failed to load group.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [savmGroupId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  if (!savmGroupId) return null;

  const winningAccount = group?.am?.am_source_account_name ?? null;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <button
        aria-label="Close group detail"
        onClick={onClose}
        className="absolute inset-0"
        style={{ background: 'rgba(8,13,68,0.25)' }}
      />
      <aside
        className="relative h-full w-full max-w-[620px] overflow-y-auto shadow-xl"
        style={{ background: '#F4F3EE', borderLeft: '1px solid #E5E3DC' }}
      >
        <header
          className="sticky top-0 flex items-start justify-between gap-3 px-4 py-3"
          style={{ background: '#F4F3EE', borderBottom: '1px solid #E5E3DC' }}
        >
          <div className="min-w-0">
            <h2 className="text-[13px] font-medium truncate" style={{ color: '#080D44' }}>
              {group?.savm_group_name || 'SAVM group'}
            </h2>
            <p className="text-[11px] font-mono" style={{ color: '#6B6B66' }}>
              {savmGroupId}
              {group ? ` · ${group.account_count} account${group.account_count === 1 ? '' : 's'}` : ''}
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

        <div className="px-4 py-3 space-y-3">
          {isLoading && (
            <p className="text-[11px]" style={{ color: '#6B6B66' }}>
              Loading group…
            </p>
          )}
          {error && (
            <p className="text-[11px]" style={{ color: '#A12622' }}>
              {error}
            </p>
          )}

          {group && (
            <>
              <div
                className="rounded-md border p-3"
                style={{ borderColor: '#E5E3DC', background: '#FFFFFF' }}
              >
                <p className="text-[10px] uppercase tracking-[0.06em]" style={{ color: '#6B6B66' }}>
                  Group attributes
                </p>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                  {[
                    ['Vertical', group.vertical],
                    ['Segment', group.segment],
                    ['Tier', group.tier],
                    ['Source', group.source],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <dt style={{ color: '#6B6B66' }}>{label}</dt>
                      <dd style={{ color: '#080D44' }}>{value || '—'}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div
                className="rounded-md border p-3"
                style={{ borderColor: '#E5E3DC', background: '#FFFFFF' }}
              >
                <p className="text-[10px] uppercase tracking-[0.06em]" style={{ color: '#6B6B66' }}>
                  Account executive for a group-level match
                </p>
                {group.am ? (
                  <div className="mt-1.5 text-[11px]">
                    <p style={{ color: '#080D44' }}>{group.am.am_name || group.am.am_email}</p>
                    <p style={{ color: '#6B6B66' }}>{group.am.am_email}</p>
                    <p className="mt-1" style={{ color: '#6B6B66' }}>
                      {group.am.am_confidence}
                      {group.am.am_priority != null ? ` · priority ${group.am.am_priority}` : ''}
                      {winningAccount ? ` · via ${winningAccount}` : ''}
                    </p>
                    {group.am.am_reason && (
                      <p className="mt-1" style={{ color: '#6B6B66' }}>
                        {group.am.am_reason}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] mt-1.5" style={{ color: '#6B6B66' }}>
                    No account in this group has a nominated AE.
                  </p>
                )}
              </div>

              <div>
                <p
                  className="text-[10px] uppercase tracking-[0.06em] mb-1.5"
                  style={{ color: '#6B6B66' }}
                >
                  Accounts in this group
                </p>
                <div
                  className="rounded-md border overflow-hidden"
                  style={{ borderColor: '#E5E3DC', background: '#FFFFFF' }}
                >
                  <table className="w-full text-[11px]">
                    <thead style={{ background: '#F8F7F4', color: '#6B6B66' }}>
                      <tr>
                        <th className="text-left px-2.5 py-1.5 font-medium">Account</th>
                        <th className="text-left px-2.5 py-1.5 font-medium">State</th>
                        <th className="text-left px-2.5 py-1.5 font-medium">AE</th>
                        <th className="text-left px-2.5 py-1.5 font-medium">Confidence</th>
                        <th className="text-left px-2.5 py-1.5 font-medium">Pri</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.accounts.map((account) => {
                        const isWinner =
                          winningAccount != null && account.sfdc_account_name === winningAccount;
                        return (
                          <tr
                            key={account.id}
                            className="border-t"
                            style={{
                              borderColor: '#F0EEE9',
                              background: isWinner ? '#ECF6EE' : undefined,
                            }}
                          >
                            <td className="px-2.5 py-1.5" style={{ color: '#080D44' }}>
                              <span className="inline-flex items-center gap-1">
                                {isWinner && (
                                  <Star
                                    className="w-2.5 h-2.5 flex-shrink-0"
                                    style={{ color: '#2C6E3F' }}
                                  />
                                )}
                                {account.sfdc_account_name || '—'}
                              </span>
                            </td>
                            <td className="px-2.5 py-1.5" style={{ color: '#6B6B66' }}>
                              {account.state || '—'}
                            </td>
                            <td className="px-2.5 py-1.5" style={{ color: '#6B6B66' }}>
                              {account.am_name || account.am_email || '—'}
                            </td>
                            <td className="px-2.5 py-1.5" style={{ color: '#6B6B66' }}>
                              {account.am_confidence || '—'}
                            </td>
                            <td className="px-2.5 py-1.5 font-mono" style={{ color: '#6B6B66' }}>
                              {account.am_priority ?? '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] mt-1.5" style={{ color: '#6B6B66' }}>
                  The starred row is the one a SAVM-level match takes its AE from: lowest priority
                  wins, ties break alphabetically.
                </p>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
