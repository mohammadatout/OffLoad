'use client';

import { useState, useMemo } from 'react';
import { MatchResult, MatchStats } from '@/lib/matchingTypes';
import ReviewQueue from './ReviewQueue';
import type { ReviewDecision } from '@/lib/matchingTypes';

interface MatchingResultsProps {
  results: MatchResult[];
  stats: MatchStats;
  reviewDecisions: ReviewDecision[];
  onReviewDecisionsChange: (decisions: ReviewDecision[]) => void;
}

type ResultTab = 'all' | 'stages' | 'review';

const ROWS_PER_PAGE = 50;

export default function MatchingResults({ results, stats, reviewDecisions, onReviewDecisionsChange }: MatchingResultsProps) {
  const [activeTab, setActiveTab] = useState<ResultTab>('all');
  const [page, setPage] = useState(0);
  const [sortDesc, setSortDesc] = useState(true);

  const tabs: { id: ResultTab; label: string }[] = [
    { id: 'all', label: 'All Matches' },
    { id: 'stages', label: 'Stage Breakdown' },
    { id: 'review', label: 'Review Queue' },
  ];

  const sortedResults = useMemo(() => {
    const matched = results.filter(r => r.Match_Status === 'Matched');
    return [...matched].sort((a, b) =>
      sortDesc ? b.Confidence_Score - a.Confidence_Score : a.Confidence_Score - b.Confidence_Score
    );
  }, [results, sortDesc]);

  const totalPages = Math.ceil(sortedResults.length / ROWS_PER_PAGE);
  const pageResults = sortedResults.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);

  const reviewItems = useMemo(() =>
    results.filter(r => r.Match_Stage === 'review'),
    [results]
  );

  return (
    <div>
      {/* Tab bar */}
      <div className="flex items-center gap-4 mb-4 border-b" style={{ borderColor: '#E5E3DC' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setPage(0); }}
            className="pb-2 text-[12px] font-medium transition-colors"
            style={{
              color: activeTab === tab.id ? '#0A0A0A' : '#6B6B66',
              borderBottom: activeTab === tab.id ? '2px solid #0A0A0A' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {tab.label}
            {tab.id === 'review' && reviewItems.length > 0 && (
              <span className="ml-1.5 font-mono text-[10px] px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(10,10,10,0.07)' }}>
                {reviewItems.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'all' && (
        <div>
          <div className="data-table overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left px-3 py-2">Internal Name</th>
                  <th className="text-left px-3 py-2">Matched Name</th>
                  <th
                    className="text-left px-3 py-2 cursor-pointer select-none"
                    onClick={() => setSortDesc(!sortDesc)}
                  >
                    Score {sortDesc ? '↓' : '↑'}
                  </th>
                  <th className="text-left px-3 py-2">Stage</th>
                  <th className="text-left px-3 py-2">State</th>
                </tr>
              </thead>
              <tbody>
                {pageResults.map((r, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">{String(r[Object.keys(r).find(k => k.includes('Internal') || k.includes('internal') || k === 'Full_Entity_Name') || ''] || '')}</td>
                    <td className="px-3 py-2">{r.Matched_Name}</td>
                    <td className="px-3 py-2 font-mono">{Number(r.Confidence_Score).toFixed(2)}</td>
                    <td className="px-3 py-2">{r.Match_Stage}</td>
                    <td className="px-3 py-2">{r.State}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3 px-1">
              <span className="text-[10px] font-mono" style={{ color: '#6B6B66' }}>
                {sortedResults.length} matched results
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                  className="text-[11px] px-2 py-1 rounded disabled:opacity-30"
                  style={{ color: '#0A0A0A' }}
                >
                  Prev
                </button>
                <span className="text-[10px] font-mono" style={{ color: '#6B6B66' }}>
                  {page + 1} / {totalPages}
                </span>
                <button
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(page + 1)}
                  className="text-[11px] px-2 py-1 rounded disabled:opacity-30"
                  style={{ color: '#0A0A0A' }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'stages' && (
        <StageBreakdown stats={stats} />
      )}

      {activeTab === 'review' && (
        <ReviewQueue
          items={reviewItems}
          decisions={reviewDecisions}
          onDecisionsChange={onReviewDecisionsChange}
        />
      )}
    </div>
  );
}

function StageBreakdown({ stats }: { stats: MatchStats }) {
  const stages = [
    { label: 'Stage 0 - Exact', count: stats.stage_0_exact, color: '#0A0A0A' },
    { label: 'Stage 1 - High Confidence', count: stats.stage_1_high_confidence, color: '#0A0A0A' },
    { label: 'Stage 2 - Confident', count: stats.stage_2_confident, color: '#0A0A0A' },
    { label: 'Stage 3 - Probable', count: stats.stage_3_probable, color: '#0A0A0A' },
    { label: 'Stage 4 - Review', count: stats.stage_4_review, color: '#B8860B' },
    { label: 'Unmatched', count: stats.unmatched, color: '#6B6B66' },
  ];

  const maxCount = Math.max(...stages.map(s => s.count), 1);

  return (
    <div>
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-3 rounded-md" style={{ background: '#fff', border: '1px solid #E5E3DC' }}>
          <div className="text-[10px] uppercase tracking-wide" style={{ color: '#6B6B66' }}>Match Rate</div>
          <div className="text-[20px] font-mono font-medium mt-1" style={{ color: '#0A0A0A' }}>
            {(stats.match_rate * 100).toFixed(1)}%
          </div>
        </div>
        <div className="p-3 rounded-md" style={{ background: '#fff', border: '1px solid #E5E3DC' }}>
          <div className="text-[10px] uppercase tracking-wide" style={{ color: '#6B6B66' }}>Total Matched</div>
          <div className="text-[20px] font-mono font-medium mt-1" style={{ color: '#0A0A0A' }}>
            {stats.total_matched.toLocaleString()}
          </div>
        </div>
        <div className="p-3 rounded-md" style={{ background: '#fff', border: '1px solid #E5E3DC' }}>
          <div className="text-[10px] uppercase tracking-wide" style={{ color: '#6B6B66' }}>Elapsed</div>
          <div className="text-[20px] font-mono font-medium mt-1" style={{ color: '#0A0A0A' }}>
            {stats.elapsed_time.toFixed(1)}s
          </div>
        </div>
      </div>

      {/* Stage bars */}
      <div className="flex flex-col gap-3">
        {stages.map((stage) => (
          <div key={stage.label} className="flex items-center gap-3">
            <span className="text-[11px] w-[180px] flex-shrink-0" style={{ color: '#0A0A0A' }}>
              {stage.label}
            </span>
            <div className="flex-1 h-1 rounded-full" style={{ background: '#E5E3DC' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(stage.count / maxCount) * 100}%`,
                  background: stage.color,
                }}
              />
            </div>
            <span className="font-mono text-[11px] w-[50px] text-right" style={{ color: '#0A0A0A' }}>
              {stage.count.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
