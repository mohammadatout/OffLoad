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
         style={{ background: '#F4F3EE', color: '#080D44', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Top Bar */}
      <header style={{ borderBottom: '1px solid #E5E3DC', background: 'rgba(244,243,238,0.95)', backdropFilter: 'blur(8px)' }}
              className="sticky top-0 z-50 flex-shrink-0">
        <div className="max-w-[1440px] mx-auto px-phi-3 h-12 flex items-center justify-between">
          <div className="flex items-center gap-6 min-w-0">
            {/* Brand */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-5 h-5 rounded-sm flex items-center justify-center" style={{ background: '#080D44' }}>
                <span className="text-[10px] font-bold" style={{ color: '#F4F3EE' }}>E</span>
              </div>
              <span className="text-[13px] font-medium tracking-tight" style={{ color: '#080D44' }}>EntityMatch Pro</span>
            </div>

            {/* Tab Navigation */}
            <nav className="ml-2 flex items-center gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => router.push(tab.href)}
                  className="h-8 px-3 text-[12px] rounded-md transition-colors flex items-center gap-2 whitespace-nowrap"
                  style={{
                    background: activeTab === tab.id ? 'rgba(10,10,10,0.07)' : 'transparent',
                    color: activeTab === tab.id ? '#080D44' : '#6B6B66',
                  }}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Context stats */}
          <div className="flex items-center gap-3 text-[11px] shrink-0" style={{ color: '#6B6B66' }}>
            <span className="font-mono">—</span>
            <span style={{ color: '#E5E3DC' }}>|</span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#74bf4b' }} />
              <span className="font-mono" style={{ color: '#74bf4b' }}>Ready</span>
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
