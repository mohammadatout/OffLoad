'use client';

import { useState } from 'react';
import { Layers, Target, Upload } from 'lucide-react';

interface AppShellProps {
  children: React.ReactNode;
}

type TabId = 'normalization' | 'matching';

export default function AppShell({ children }: AppShellProps) {
  const [activeTab, setActiveTab] = useState<TabId>('normalization');

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'normalization', label: 'Normalization', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'matching', label: 'Matching Engine', icon: <Target className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="flex flex-col h-screen overflow-hidden"
         style={{ background: '#F4F3EE', color: '#0A0A0A', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Top Bar */}
      <header style={{ borderBottom: '1px solid #E5E3DC', background: 'rgba(244,243,238,0.95)', backdropFilter: 'blur(8px)' }}
              className="sticky top-0 z-50 flex-shrink-0">
        <div className="max-w-[1440px] mx-auto px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-8">
            {/* Brand */}
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-sm flex items-center justify-center" style={{ background: '#0A0A0A' }}>
                <span className="text-[10px] font-bold" style={{ color: '#F4F3EE' }}>E</span>
              </div>
              <span className="text-[13px] font-medium tracking-tight" style={{ color: '#0A0A0A' }}>EntityMatch Pro</span>
            </div>

            {/* Tab Navigation */}
            <nav className="flex items-center gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="px-3 h-7 text-[12px] rounded-md transition-colors flex items-center gap-1.5"
                  style={{
                    background: activeTab === tab.id ? 'rgba(10,10,10,0.07)' : 'transparent',
                    color: activeTab === tab.id ? '#0A0A0A' : '#6B6B66',
                  }}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Context stats */}
          <div className="flex items-center gap-4 text-[11px]" style={{ color: '#6B6B66' }}>
            <span className="font-mono">—</span>
            <span style={{ color: '#E5E3DC' }}>|</span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#0A0A0A' }} />
              <span className="font-mono">Ready</span>
            </span>
          </div>
        </div>
      </header>

      {/* Normalization content */}
      <div
        style={{
          display: activeTab === 'normalization' ? 'block' : 'none',
          flex: 1,
          overflow: 'auto',
        }}
      >
        {children}
      </div>

      {/* Matching Engine content */}
      <div
        style={{
          display: activeTab === 'matching' ? 'flex' : 'none',
          flex: 1,
          overflow: 'auto',
        }}
        className="flex-col"
      >
        <MatchingEnginePlaceholder />
      </div>
    </div>
  );
}

function MatchingEnginePlaceholder() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
      <div className="w-16 h-16 rounded-xl flex items-center justify-center"
           style={{ background: '#fff', border: '1px solid #E5E3DC' }}>
        <Target className="w-8 h-8" style={{ color: '#0A0A0A' }} />
      </div>
      <div className="text-center max-w-md">
        <h2 className="text-[18px] font-medium mb-2" style={{ color: '#0A0A0A' }}>Matching Engine</h2>
        <p className="text-[13px] leading-relaxed" style={{ color: '#6B6B66' }}>
          Configure and run entity matching across your normalized datasets.
          Upload your data through the Normalization tab first, then come here to match.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-md text-[12px]"
             style={{ background: '#fff', border: '1px solid #E5E3DC', color: '#6B6B66' }}>
          <Upload className="w-3.5 h-3.5" />
          <span>Awaiting normalized data</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 mt-4 w-full max-w-lg">
        {[
          { label: 'Token Match', desc: 'Fuzzy token-level matching' },
          { label: 'Abbreviation', desc: 'Expand known abbreviations' },
          { label: 'Threshold', desc: 'Configurable match scores' },
        ].map((item) => (
          <div key={item.label} className="p-3 rounded-md"
               style={{ background: '#fff', border: '1px solid #E5E3DC' }}>
            <div className="text-[11px] font-medium mb-1" style={{ color: '#0A0A0A' }}>{item.label}</div>
            <div className="text-[10px]" style={{ color: '#6B6B66' }}>{item.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
