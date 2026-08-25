'use client';

import { AlertTriangle } from 'lucide-react';
import { ImportBatchSummary } from '@/lib/libraryTypes';

interface ImportResultCardProps {
  title: string;
  summary: ImportBatchSummary | null;
}

interface Counter {
  label: string;
  value: number;
  highlight?: boolean;
}

export default function ImportResultCard({ title, summary }: ImportResultCardProps) {
  if (!summary) return null;

  const issues = summary.error_report?.rows ?? [];
  const warnings = summary.error_report?.warnings ?? [];

  const counters: Counter[] = [
    { label: 'Rows read', value: summary.row_count },
    { label: 'Inserted', value: summary.inserted },
    { label: 'Updated', value: summary.updated },
    { label: 'Deactivated', value: summary.deactivated ?? 0 },
    { label: 'Skipped', value: summary.skipped },
    { label: 'Blank rows skipped', value: summary.skipped_blank ?? 0 },
    { label: 'Failed', value: summary.failed, highlight: summary.failed > 0 },
    {
      label: 'Newly unlinked matches',
      value: summary.newly_unlinked ?? 0,
      highlight: (summary.newly_unlinked ?? 0) > 0,
    },
  ];

  return (
    <div
      className="rounded-md border p-3 mt-3"
      style={{ borderColor: '#E5E3DC', background: '#FBFAF7' }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[12px] font-medium" style={{ color: '#080D44' }}>
          {title}
        </h3>
        <span className="text-[10px] font-mono" style={{ color: '#6B6B66' }}>
          {summary.filename}
        </span>
      </div>

      <dl className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
        {counters.map((counter) => (
          <div key={counter.label}>
            <dt className="text-[10px] uppercase tracking-[0.06em]" style={{ color: '#6B6B66' }}>
              {counter.label}
            </dt>
            <dd
              className="text-[14px] font-medium font-mono"
              style={{ color: counter.highlight && counter.value > 0 ? '#B8860B' : '#080D44' }}
            >
              {counter.value.toLocaleString()}
            </dd>
          </div>
        ))}
      </dl>

      {(summary.newly_unlinked ?? 0) > 0 && (
        <div
          className="mt-3 flex items-start gap-2 rounded p-2"
          style={{ background: '#FDF8E8', border: '1px solid #E5D5A0' }}
        >
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#B8860B' }} />
          <p className="text-[10px]" style={{ color: '#080D44' }}>
            {summary.newly_unlinked} existing match(es) point at a SAVM group that is no longer in
            the reference file. They were flagged <strong>unlinked</strong>, never deleted. Review
            them in the Match Library.
          </p>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-medium" style={{ color: '#080D44' }}>
            Warnings
          </p>
          <ul className="text-[10px] mt-1 space-y-0.5" style={{ color: '#6B6B66' }}>
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {issues.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-medium" style={{ color: '#080D44' }}>
            Row issues ({issues.length}
            {issues.length >= 500 ? '+, truncated' : ''})
          </p>
          <div className="mt-1 max-h-[160px] overflow-y-auto">
            <ul className="text-[10px] space-y-0.5 font-mono" style={{ color: '#6B6B66' }}>
              {issues.slice(0, 50).map((issue, index) => (
                <li key={`${issue.row}-${issue.reason}-${index}`}>
                  row {issue.row}: {issue.reason}
                  {issue.status ? ` (${issue.status})` : ''}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
