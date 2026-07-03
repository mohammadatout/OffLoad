'use client';

import { useState } from 'react';
import { ChevronRight, AlertTriangle, Plus, X } from 'lucide-react';
import { MatchConfig } from '@/lib/matchingTypes';
import { Switch } from '@/components/ui/Switch';

interface MatchingConfigPanelProps {
  config: MatchConfig;
  onConfigChange: (update: Partial<MatchConfig>) => void;
}

type Section = 'strategy' | 'abbreviations' | null;

export default function MatchingConfigPanel({ config, onConfigChange }: MatchingConfigPanelProps) {
  const [openSection, setOpenSection] = useState<Section>(null);
  const [newAbbrevKey, setNewAbbrevKey] = useState('');
  const [newAbbrevVal, setNewAbbrevVal] = useState('');

  function toggleSection(section: Section) {
    setOpenSection(openSection === section ? null : section);
  }

  function addAbbreviation() {
    if (!newAbbrevKey.trim() || !newAbbrevVal.trim()) return;
    const updated = { ...(config.abbreviations || {}), [newAbbrevKey.trim().toUpperCase()]: newAbbrevVal.trim().toUpperCase() };
    onConfigChange({ abbreviations: updated });
    setNewAbbrevKey('');
    setNewAbbrevVal('');
  }

  function removeAbbreviation(key: string) {
    if (!config.abbreviations) return;
    const updated = { ...config.abbreviations };
    delete updated[key];
    onConfigChange({ abbreviations: Object.keys(updated).length > 0 ? updated : null });
  }

  return (
    <div className="w-[320px] flex-shrink-0 overflow-y-auto border-r" style={{ borderColor: '#E5E3DC' }}>
      <div className="p-4">
        <h2 className="text-[12px] font-medium uppercase tracking-wide mb-4" style={{ color: '#6B6B66' }}>
          Configuration
        </h2>

        {/* Match Strategy */}
        <div className="config-section" style={{ borderBottom: '1px solid #E5E3DC' }}>
          <button
            onClick={() => toggleSection('strategy')}
            className="config-section-header w-full flex items-center justify-between px-3 h-9 text-[12px] font-medium transition-colors"
            style={{ color: '#0A0A0A' }}
          >
            <span>Match Strategy</span>
            <ChevronRight
              className="w-3.5 h-3.5 transition-transform"
              style={{ transform: openSection === 'strategy' ? 'rotate(90deg)' : 'rotate(0deg)' }}
            />
          </button>

          {openSection === 'strategy' && (
            <div className="config-section-body px-3 pb-4 pt-2 flex flex-col gap-4">
              {/* State Blocking Toggle */}
              <div className="flex items-center justify-between">
                <span className="text-[11px]" style={{ color: '#0A0A0A' }}>State Blocking</span>
                <Switch
                  checked={config.use_state_blocking}
                  onCheckedChange={(checked) => onConfigChange({ use_state_blocking: checked })}
                />
              </div>

              {config.use_state_blocking && (
                <div className="callout-warn flex items-start gap-2 p-2 rounded-md text-[10px]"
                     style={{ background: '#FDF8E8', border: '1px solid #E5D5A0' }}>
                  <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: '#B8860B' }} />
                  <span style={{ color: '#6B6B66' }}>
                    If external file has no state info, all matches will return zero.
                  </span>
                </div>
              )}

              {/* Context Validation Toggle */}
              <div className="flex items-center justify-between">
                <span className="text-[11px]" style={{ color: '#0A0A0A' }}>Context Validation</span>
                <Switch
                  checked={config.use_context_validation}
                  onCheckedChange={(checked) => onConfigChange({ use_context_validation: checked })}
                />
              </div>
            </div>
          )}
        </div>

        {/* Abbreviation Dictionary */}
        <div className="config-section" style={{ borderBottom: '1px solid #E5E3DC' }}>
          <button
            onClick={() => toggleSection('abbreviations')}
            className="config-section-header w-full flex items-center justify-between px-3 h-9 text-[12px] font-medium transition-colors"
            style={{ color: '#0A0A0A' }}
          >
            <span>Abbreviation Dictionary</span>
            <ChevronRight
              className="w-3.5 h-3.5 transition-transform"
              style={{ transform: openSection === 'abbreviations' ? 'rotate(90deg)' : 'rotate(0deg)' }}
            />
          </button>

          {openSection === 'abbreviations' && (
            <div className="config-section-body px-3 pb-4 pt-2">
              <p className="text-[10px] mb-3" style={{ color: '#6B6B66' }}>
                Custom abbreviations override built-in defaults. Leave empty to use defaults only.
              </p>

              {config.abbreviations && Object.entries(config.abbreviations).length > 0 && (
                <div className="flex flex-col gap-1 mb-3 max-h-[200px] overflow-y-auto">
                  {Object.entries(config.abbreviations).map(([key, val]) => (
                    <div key={key} className="flex items-center justify-between px-2 py-1 rounded"
                         style={{ background: 'rgba(10,10,10,0.03)' }}>
                      <span className="font-mono text-[10px]" style={{ color: '#0A0A0A' }}>
                        {key} → {val}
                      </span>
                      <button onClick={() => removeAbbreviation(key)} className="p-0.5">
                        <X className="w-3 h-3" style={{ color: '#6B6B66' }} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-1">
                <input
                  value={newAbbrevKey}
                  onChange={(e) => setNewAbbrevKey(e.target.value)}
                  placeholder="ABBR"
                  className="flex-1 h-7 px-2 rounded text-[10px] font-mono"
                  style={{ border: '1px solid #E5E3DC', background: '#fff', color: '#0A0A0A' }}
                />
                <input
                  value={newAbbrevVal}
                  onChange={(e) => setNewAbbrevVal(e.target.value)}
                  placeholder="FULL EXPANSION"
                  className="flex-[2] h-7 px-2 rounded text-[10px] font-mono"
                  style={{ border: '1px solid #E5E3DC', background: '#fff', color: '#0A0A0A' }}
                />
                <button
                  onClick={addAbbreviation}
                  className="h-7 w-7 flex items-center justify-center rounded"
                  style={{ background: '#0A0A0A' }}
                >
                  <Plus className="w-3 h-3" style={{ color: '#F4F3EE' }} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
