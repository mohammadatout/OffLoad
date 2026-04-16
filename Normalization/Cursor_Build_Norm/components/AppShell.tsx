'use client';

import { useState } from 'react';
import { Layers, Target } from 'lucide-react';

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const [activeTab, setActiveTab] = useState<'normalization' | 'matching'>('normalization');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Tab Bar */}
      <div className="offload-tab-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#00E5FF', letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginRight: '1.5rem' }}>
            OffLoad
          </span>
          <button
            className={`offload-tab ${activeTab === 'normalization' ? 'active' : ''}`}
            onClick={() => setActiveTab('normalization')}
          >
            <Layers size={14} />
            Normalization
          </button>
          <button
            className={`offload-tab ${activeTab === 'matching' ? 'active' : ''}`}
            onClick={() => setActiveTab('matching')}
          >
            <Target size={14} />
            Matching Engine
          </button>
        </div>
      </div>

      {/* Normalization content */}
      <div style={{
        display: activeTab === 'normalization' ? 'block' : 'none',
        flex: 1,
        overflow: 'auto',
      }}>
        {children}
      </div>

      {/* Matching Engine iframe */}
      <iframe
        src="http://localhost:8501"
        title="Matching Engine"
        allow="clipboard-read; clipboard-write"
        style={{
          display: activeTab === 'matching' ? 'block' : 'none',
          flex: 1,
          width: '100%',
          border: 'none',
          backgroundColor: '#000000',
        }}
      />
    </div>
  );
}
