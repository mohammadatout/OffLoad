'use client';

import { useEffect, useState } from 'react';
import AllocationBrowser from '@/components/allocation/AllocationBrowser';
import { fetchAccountFacets } from '@/lib/libraryApi';
import { AccountFacets } from '@/lib/libraryTypes';

export default function AllocationPage() {
  const [facets, setFacets] = useState<AccountFacets | null>(null);

  useEffect(() => {
    fetchAccountFacets()
      .then(setFacets)
      .catch(() => setFacets(null));
  }, []);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1600px] mx-auto px-phi-3 py-phi-3 space-y-3">
        <div>
          <h1 className="text-[16px] font-medium" style={{ color: '#080D44' }}>
            Account Executive Allocation
          </h1>
          <p className="text-[12px] mt-1" style={{ color: '#6B6B66' }}>
            The Cisco account reference and its nominated account executive.
            {facets
              ? ` ${facets.total_accounts.toLocaleString()} accounts across ${facets.total_groups.toLocaleString()} SAVM groups.`
              : ''}{' '}
            Click any row to see every account in its SAVM group and which one the nomination comes
            from.
          </p>
        </div>

        <AllocationBrowser />
      </div>
    </div>
  );
}
