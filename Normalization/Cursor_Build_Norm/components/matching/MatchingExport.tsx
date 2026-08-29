'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { MatchResult, ReviewDecision } from '@/lib/matchingTypes';
import { DEFAULT_PRIMARY_COLUMNS, buildMatchingExportTables } from '@/lib/matchingOutput';
import {
  clearMatchingPrimaryColumns,
  loadMatchingPrimaryColumns,
  saveMatchingPrimaryColumns,
} from '@/lib/storage';
import { buildMatchingWorkbook } from '@/lib/matchingWorkbook';

interface MatchingExportProps {
  results: MatchResult[];
  reviewDecisions: ReviewDecision[];
  externalCol: string;
  internalCol: string;
  externalFileName: string;
}

export default function MatchingExport({
  results,
  reviewDecisions,
  externalCol,
  internalCol,
  externalFileName,
}: MatchingExportProps) {
  const [showColumns, setShowColumns] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<string[] | null>(null);

  useEffect(() => {
    setSelectedColumns(loadMatchingPrimaryColumns());
  }, []);

  const enrichedResults = useMemo(
    () =>
      results.map((result, idx) => {
        const reviewItem = reviewDecisions.find((decision) => decision.internalIdx === idx);
        return {
          ...result,
          Review_Decision: reviewItem ? (reviewItem.accepted ? 'Accepted' : 'Rejected') : '',
          Review_Selected: reviewItem?.selectedCandidate || '',
        } as MatchResult;
      }),
    [results, reviewDecisions]
  );

  const tables = useMemo(
    () =>
      buildMatchingExportTables(
        enrichedResults,
        externalCol,
        internalCol,
        selectedColumns
      ),
    [enrichedResults, externalCol, internalCol, selectedColumns]
  );

  const selectedSet = useMemo(
    () => new Set(tables.selectedPrimaryColumns),
    [tables.selectedPrimaryColumns]
  );

  function persistColumns(nextColumns: string[] | null) {
    setSelectedColumns(nextColumns);
    if (nextColumns && nextColumns.length > 0) {
      saveMatchingPrimaryColumns(nextColumns);
    } else {
      clearMatchingPrimaryColumns();
    }
  }

  function toggleColumn(column: string, enabled: boolean) {
    const current = tables.selectedPrimaryColumns;
    if (enabled) {
      if (current.includes(column)) return;
      persistColumns([...current, column]);
      return;
    }
    const next = current.filter((value) => value !== column);
    if (next.length === 0) return;
    persistColumns(next);
  }

  function moveColumn(column: string, direction: -1 | 1) {
    const current = [...tables.selectedPrimaryColumns];
    const index = current.indexOf(column);
    if (index < 0) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= current.length) return;
    [current[index], current[targetIndex]] = [current[targetIndex], current[index]];
    persistColumns(current);
  }

  function resetPrimaryColumns() {
    persistColumns([...DEFAULT_PRIMARY_COLUMNS]);
  }

  function exportWorkbook() {
    const { workbook, fileName } = buildMatchingWorkbook(tables, externalFileName);
    XLSX.writeFile(workbook, fileName, { compression: true });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setShowColumns((prev) => !prev)}
        className="h-10 px-4 rounded-full text-[12px] font-medium"
        style={{ background: 'transparent', color: '#080D44', border: '1px solid #E5E3DC' }}
      >
        Primary Columns ({tables.selectedPrimaryColumns.length})
      </button>
      <button
        onClick={exportWorkbook}
        className="btn-pill-primary h-10 px-5 rounded-full text-[12px] font-medium flex items-center gap-2 transition-colors"
        style={{ background: '#0A0A0A', color: '#F4F3EE' }}
      >
        <Download className="w-3.5 h-3.5" />
        Export Workbook
      </button>

      {showColumns && (
        <div
          className="absolute right-4 top-20 z-20 w-[440px] max-h-[480px] overflow-y-auto rounded-md border p-3"
          style={{ borderColor: '#E5E3DC', background: '#FFFFFF' }}
        >
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-medium" style={{ color: '#080D44' }}>
              Primary Sheet Columns
            </p>
            <button
              type="button"
              onClick={resetPrimaryColumns}
              className="text-[10px] underline"
              style={{ color: '#6B6B66' }}
            >
              Reset to default
            </button>
          </div>
          <p className="text-[10px] mt-1 mb-2" style={{ color: '#6B6B66' }}>
            Reorder selected columns with arrows. Detail sheet always includes full data.
          </p>
          <div className="space-y-1">
            {tables.availablePrimaryColumns.map((column) => {
              const selected = selectedSet.has(column);
              const position = tables.selectedPrimaryColumns.indexOf(column);
              return (
                <div
                  key={column}
                  className="flex items-center gap-2 rounded px-2 py-1"
                  style={{ background: selected ? '#F8F7F4' : 'transparent' }}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(event) => toggleColumn(column, event.target.checked)}
                  />
                  <span className="text-[11px] flex-1" style={{ color: '#080D44' }}>
                    {column}
                  </span>
                  {selected && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveColumn(column, -1)}
                        disabled={position <= 0}
                        className="h-6 w-6 rounded border text-[10px] disabled:opacity-40"
                        style={{ borderColor: '#E5E3DC', color: '#080D44' }}
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveColumn(column, 1)}
                        disabled={position < 0 || position >= tables.selectedPrimaryColumns.length - 1}
                        className="h-6 w-6 rounded border text-[10px] disabled:opacity-40"
                        style={{ borderColor: '#E5E3DC', color: '#080D44' }}
                        title="Move down"
                      >
                        ↓
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
