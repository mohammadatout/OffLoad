'use client';

import { Suspense, useCallback, useState } from 'react';
import AllocationBrowser from '@/components/allocation/AllocationBrowser';

export default function AllocationPage() {
  // Totals come up from the browser rather than being fetched again here: the
  // facet call is expensive and one per page load is enough.
  const [totals, setTotals] = useState<{ accounts: number; groups: number } | null>(null);
  const handleTotals = useCallback(
    (next: { accounts: number; groups: number } | null) => setTotals(next),
    []
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1600px] mx-auto px-phi-3 py-phi-3 space-y-3">
        <div>
          <h1 className="text-[16px] font-medium" style={{ color: '#080D44' }}>
            Account Executive Allocation
          </h1>
          <p className="text-[12px] mt-1" style={{ color: '#6B6B66' }}>
            The Cisco account reference and its nominated account executive.
            {totals
              ? ` ${totals.accounts.toLocaleString()} accounts across ${totals.groups.toLocaleString()} SAVM groups.`
              : ''}{' '}
            Click any row to see every account in its SAVM group and which one the nomination comes
            from.
          </p>
        </div>

        <Suspense
          fallback={
            <div
              className="rounded-md border p-3 text-[12px]"
              style={{ borderColor: '#E5E3DC', color: '#6B6B66', background: '#FFFFFF' }}
            >
              Loading allocation filters...
            </div>
          }
        >
          <AllocationBrowser onTotalsChange={handleTotals} />
        </Suspense>
      </div>
    </div>
  );
}
