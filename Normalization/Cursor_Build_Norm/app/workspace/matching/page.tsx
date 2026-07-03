'use client';

import { useState, useCallback, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { MatchConfig, MatchResult, MatchStats, ReviewDecision } from '@/lib/matchingTypes';
import { runMatching } from '@/lib/matcherApi';
import MatchingConfigPanel from '@/components/matching/MatchingConfigPanel';
import MatchingUpload from '@/components/matching/MatchingUpload';
import MatchingResults from '@/components/matching/MatchingResults';
import MatchingExport from '@/components/matching/MatchingExport';

interface UploadedFile {
  file: File;
  headers: string[];
  rowCount: number;
}

type MatchingView = 'upload' | 'running' | 'results';

const hasStateLikeHeader = (headers: string[]): boolean => {
  return headers.some((header) => {
    const normalized = header.toLowerCase();
    if (/street|status/.test(normalized)) return false;
    return /\bstate\b|\bprovince\b|\bregion\b|\bterritory\b|(^|_)st($|_)/i.test(normalized);
  });
};

export default function MatchingPage() {
  const [view, setView] = useState<MatchingView>('upload');
  const [error, setError] = useState('');

  const [externalFile, setExternalFile] = useState<UploadedFile | null>(null);
  const [internalFile, setInternalFile] = useState<UploadedFile | null>(null);
  const [externalCol, setExternalCol] = useState('');
  const [internalCol, setInternalCol] = useState('');

  const [config, setConfig] = useState<MatchConfig>({
    internal_col: '',
    external_col: '',
    use_state_blocking: false,
    use_context_validation: true,
    abbreviations: null,
  });

  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [stats, setStats] = useState<MatchStats | null>(null);
  const [reviewDecisions, setReviewDecisions] = useState<ReviewDecision[]>([]);

  const updateConfig = useCallback((update: Partial<MatchConfig>) => {
    setConfig(prev => ({ ...prev, ...update }));
  }, []);

  const canRun = externalFile && internalFile && externalCol && internalCol;
  const externalHasStateHint = useMemo(
    () => (externalFile ? hasStateLikeHeader(externalFile.headers) : false),
    [externalFile]
  );
  const internalHasStateHint = useMemo(
    () => (internalFile ? hasStateLikeHeader(internalFile.headers) : false),
    [internalFile]
  );

  const stateBlockingWarning = useMemo(() => {
    if (!config.use_state_blocking || !externalFile || !internalFile) return null;
    if (!externalHasStateHint && !internalHasStateHint) {
      return {
        title: 'State Blocking is ON but no state-like column was detected in either file',
        detail:
          'This usually causes zero matches. Add a state column, or turn off State Blocking before run.',
      };
    }
    if (!externalHasStateHint) {
      return {
        title: 'State Blocking is ON but external source appears to have no state column',
        detail:
          'Matching quality may collapse to zero. Add state in source data or disable State Blocking.',
      };
    }
    if (!internalHasStateHint) {
      return {
        title: 'State Blocking is ON but internal target appears to have no state column',
        detail:
          'Matching quality may collapse to zero. Add a state-like target column or disable State Blocking.',
      };
    }
    return null;
  }, [config.use_state_blocking, externalFile, internalFile, externalHasStateHint, internalHasStateHint]);

  async function handleRun() {
    if (!canRun) return;
    setError('');
    setView('running');
    setReviewDecisions([]);

    try {
      const matchConfig: MatchConfig = {
        ...config,
        // Matcher engine iterates over "internal_df", so we map External source to it.
        internal_col: externalCol,
        external_col: internalCol,
      };

      const response = await runMatching(externalFile.file, internalFile.file, matchConfig);
      setResults(response.results);
      setStats(response.stats);
      setView('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Matching failed');
      setView('upload');
    }
  }

  function handleReset() {
    setView('upload');
    setResults(null);
    setStats(null);
    setReviewDecisions([]);
    setError('');
  }

  return (
    <div className="flex h-[calc(100vh-48px)] overflow-hidden">
      {/* Left rail - config */}
      <MatchingConfigPanel config={config} onConfigChange={updateConfig} />

      {/* Main content */}
      <div className="flex-1 overflow-y-auto h-full pr-1 pb-4">
        <div className="max-w-[1100px] mx-auto px-phi-3 py-phi-3">

          {/* Upload view */}
          {view === 'upload' && (
            <div className="flex flex-col gap-5 pt-2 lg:pt-8">
              <div>
                <h1 className="text-[16px] font-medium" style={{ color: '#080D44' }}>Entity Matching</h1>
                <p className="text-[12px] mt-1" style={{ color: '#6B6B66' }}>
                  Upload external and internal CSV files, select entity name columns, then run matching.
                </p>
              </div>

              <div className="pt-1 lg:pt-6">
                <MatchingUpload
                  externalFile={externalFile}
                  externalCol={externalCol}
                  onExternalUploaded={setExternalFile}
                  onExternalColChange={setExternalCol}
                  internalFile={internalFile}
                  internalCol={internalCol}
                  onInternalUploaded={setInternalFile}
                  onInternalColChange={setInternalCol}
                />
              </div>

              {/* State blocking smart warning */}
              {stateBlockingWarning && (
                <div className="flex items-start gap-2 p-3 rounded-md"
                     style={{ background: '#FDF8E8', border: '1px solid #E5D5A0' }}>
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#B8860B' }} />
                  <div className="flex-1">
                    <p className="text-[11px] font-medium" style={{ color: '#080D44' }}>
                      {stateBlockingWarning.title}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: '#6B6B66' }}>
                      {stateBlockingWarning.detail}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateConfig({ use_state_blocking: false })}
                    className="h-7 px-2.5 rounded-full text-[10px] font-medium border border-[#E5D5A0] bg-[#FFF8DC] hover:bg-[#FFF3C2] transition-colors"
                    style={{ color: '#080D44' }}
                  >
                    Turn off
                  </button>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-md"
                     style={{ background: '#FDF8E8', border: '1px solid #E5D5A0' }}>
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#B8860B' }} />
                  <p className="text-[11px]" style={{ color: '#080D44' }}>{error}</p>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={handleRun}
                  disabled={!canRun}
                  className="h-11 px-6 rounded-full text-[13px] font-medium transition-all inline-flex items-center justify-center"
                  style={{
                    background: canRun ? '#080D44' : '#D5D3CC',
                    color: canRun ? '#F4F3EE' : '#6B6B66',
                    cursor: canRun ? 'pointer' : 'not-allowed',
                  }}
                >
                  Run Matching
                </button>
              </div>
            </div>
          )}

          {/* Running view */}
          {view === 'running' && (
            <div className="flex flex-col items-center justify-center py-phi-5 gap-phi-2">
              <div className="w-full max-w-xs">
                <div className="h-1 rounded-full overflow-hidden" style={{ background: '#E5E3DC' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      background: '#080D44',
                      animation: 'indeterminate 1.5s ease-in-out infinite',
                      width: '40%',
                    }}
                  />
                </div>
              </div>
              <p className="text-[12px]" style={{ color: '#6B6B66' }}>
                Running matcher... This may take a moment for large files.
              </p>
              <style>{`
                @keyframes indeterminate {
                  0% { transform: translateX(-100%); }
                  100% { transform: translateX(350%); }
                }
              `}</style>
            </div>
          )}

          {/* Results view */}
          {view === 'results' && results && stats && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-[16px] font-medium" style={{ color: '#080D44' }}>Results</h1>
                  <p className="text-[12px] mt-0.5" style={{ color: '#6B6B66' }}>
                    {stats.total_matched.toLocaleString()} matched of {stats.total_internal.toLocaleString()} external entities
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <MatchingExport
                    results={results}
                    reviewDecisions={reviewDecisions}
                    externalCol={externalCol}
                    internalCol={internalCol}
                    externalFileName={externalFile?.file.name || ''}
                  />
                  <button
                    onClick={handleReset}
                    className="h-10 px-5 rounded-full text-[12px] font-medium transition-colors"
                    style={{ background: 'transparent', color: '#080D44', border: '1px solid #E5E3DC' }}
                  >
                    New Match
                  </button>
                </div>
              </div>

              <MatchingResults
                results={results}
                stats={stats}
                reviewDecisions={reviewDecisions}
                onReviewDecisionsChange={setReviewDecisions}
                externalCol={externalCol}
                internalCol={internalCol}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
