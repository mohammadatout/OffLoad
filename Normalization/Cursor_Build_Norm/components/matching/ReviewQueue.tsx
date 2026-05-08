'use client';

import { MatchResult, ReviewDecision } from '@/lib/matchingTypes';
import { Check, X } from 'lucide-react';

interface ReviewQueueProps {
  items: MatchResult[];
  decisions: ReviewDecision[];
  onDecisionsChange: (decisions: ReviewDecision[]) => void;
}

export default function ReviewQueue({ items, decisions, onDecisionsChange }: ReviewQueueProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-[12px]" style={{ color: '#6B6B66' }}>
          No items require manual review.
        </p>
      </div>
    );
  }

  function getDecision(idx: number): ReviewDecision | undefined {
    return decisions.find(d => d.internalIdx === idx);
  }

  function setDecision(item: MatchResult, idx: number, candidate: string | null, accepted: boolean) {
    const internalName = String(item[Object.keys(item).find(k => k.includes('Internal') || k.includes('internal') || k === 'Full_Entity_Name') || ''] || '');
    const existing = decisions.filter(d => d.internalIdx !== idx);
    onDecisionsChange([...existing, { internalIdx: idx, internalName, selectedCandidate: candidate, accepted }]);
  }

  function parseCandidates(item: MatchResult): { name: string; score: string }[] {
    const raw = item.Top_3_Candidates;
    if (!raw || raw === '') return [];
    const parts = String(raw).split('|').map(s => s.trim()).filter(Boolean);
    return parts.map(p => {
      const scoreMatch = p.match(/\(([0-9.]+)\)$/);
      return {
        name: scoreMatch ? p.replace(scoreMatch[0], '').trim() : p,
        score: scoreMatch ? scoreMatch[1] : '',
      };
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[10px] mb-1" style={{ color: '#6B6B66' }}>
        {items.length} items need review. Select the best match or reject.
      </p>

      {items.map((item, idx) => {
        const candidates = parseCandidates(item);
        const decision = getDecision(idx);
        const internalName = String(item[Object.keys(item).find(k => k.includes('Internal') || k.includes('internal') || k === 'Full_Entity_Name') || ''] || '');

        return (
          <div key={idx} className="p-3 rounded-md" style={{ background: '#fff', border: '1px solid #E5E3DC' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-medium" style={{ color: '#0A0A0A' }}>
                {internalName}
              </span>
              {item.State && (
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(10,10,10,0.05)', color: '#6B6B66' }}>
                  {item.State}
                </span>
              )}
            </div>

            {candidates.length > 0 ? (
              <div className="flex flex-col gap-1.5 mb-2">
                {candidates.map((c, ci) => (
                  <label key={ci} className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors"
                         style={{
                           background: decision?.selectedCandidate === c.name ? 'rgba(10,10,10,0.05)' : 'transparent',
                         }}>
                    <input
                      type="radio"
                      name={`review-${idx}`}
                      checked={decision?.selectedCandidate === c.name}
                      onChange={() => setDecision(item, idx, c.name, true)}
                      className="w-3 h-3"
                    />
                    <span className="text-[11px] flex-1" style={{ color: '#0A0A0A' }}>{c.name}</span>
                    {c.score && (
                      <span className="font-mono text-[10px]" style={{ color: '#6B6B66' }}>{c.score}</span>
                    )}
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-[10px] mb-2" style={{ color: '#6B6B66' }}>
                Best match: {item.Matched_Name} ({Number(item.Confidence_Score).toFixed(2)})
              </p>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const candidate = decision?.selectedCandidate || (candidates[0]?.name ?? item.Matched_Name);
                  setDecision(item, idx, candidate, true);
                }}
                className="flex items-center gap-1 h-6 px-2 rounded text-[10px] font-medium transition-colors"
                style={{
                  background: decision?.accepted ? '#0A0A0A' : 'transparent',
                  color: decision?.accepted ? '#F4F3EE' : '#0A0A0A',
                  border: '1px solid #E5E3DC',
                }}
              >
                <Check className="w-3 h-3" />
                Accept
              </button>
              <button
                onClick={() => setDecision(item, idx, null, false)}
                className="flex items-center gap-1 h-6 px-2 rounded text-[10px] font-medium transition-colors"
                style={{
                  background: decision && !decision.accepted ? '#B8860B' : 'transparent',
                  color: decision && !decision.accepted ? '#fff' : '#6B6B66',
                  border: '1px solid #E5E3DC',
                }}
              >
                <X className="w-3 h-3" />
                Reject
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
