'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Layers, Target } from 'lucide-react';

interface AppShellProps {
  children: React.ReactNode;
}

type TabId = 'normalization' | 'matching';

export default function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const activeTab: TabId = pathname?.startsWith('/workspace/matching') ? 'matching' : 'normalization';

  const tabs: { id: TabId; label: string; icon: React.ReactNode; href: string }[] = [
    { id: 'normalization', label: 'Normalization', icon: <Layers className="w-3.5 h-3.5" />, href: '/workspace' },
    { id: 'matching', label: 'Matching Engine', icon: <Target className="w-3.5 h-3.5" />, href: '/workspace/matching' },
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
                  onClick={() => router.push(tab.href)}
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

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {children}
      </div>
    </div>
  );
}
