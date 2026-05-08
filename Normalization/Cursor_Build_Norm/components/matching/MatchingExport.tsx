'use client';

import { Download } from 'lucide-react';
import Papa from 'papaparse';
import { MatchResult, ReviewDecision } from '@/lib/matchingTypes';

interface MatchingExportProps {
  results: MatchResult[];
  reviewDecisions: ReviewDecision[];
}

export default function MatchingExport({ results, reviewDecisions }: MatchingExportProps) {
  function exportCsv() {
    const exportData = results.map((r, idx) => {
      const reviewItem = r.Match_Stage === 'review'
        ? reviewDecisions.find(d => d.internalIdx === idx)
        : null;

      return {
        ...r,
        Review_Decision: reviewItem ? (reviewItem.accepted ? 'Accepted' : 'Rejected') : '',
        Review_Selected: reviewItem?.selectedCandidate || '',
      };
    });

    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const a = document.createElement('a');
    a.href = url;
    a.download = `matching_results_${ts}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={exportCsv}
      className="btn-pill-primary h-10 px-5 rounded-full text-[12px] font-medium flex items-center gap-2 transition-colors"
      style={{ background: '#0A0A0A', color: '#F4F3EE' }}
    >
      <Download className="w-3.5 h-3.5" />
      Export Results as CSV
    </button>
  );
}
