'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { BookOpenText, Layers, LogOut, Shield, Target, UsersRound } from 'lucide-react';
import { getMe, logout } from '@/lib/authApi';
import { AuthUser } from '@/lib/authTypes';

interface AppShellProps {
  children: React.ReactNode;
}

type TabId = 'normalization' | 'matching' | 'library' | 'allocation' | 'admin';

export default function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      try {
        const me = await getMe();
        if (!isMounted) return;
        setCurrentUser(me);
      } catch {
        if (!isMounted) return;
        router.replace('/login');
      } finally {
        if (isMounted) {
          setIsLoadingUser(false);
        }
      }
    }

    loadSession();
    return () => {
      isMounted = false;
    };
  }, [router]);

  const activeTab: TabId = useMemo(() => {
    if (pathname?.startsWith('/workspace/admin')) return 'admin';
    if (pathname?.startsWith('/workspace/allocation')) return 'allocation';
    if (pathname?.startsWith('/workspace/library')) return 'library';
    if (pathname?.startsWith('/workspace/matching')) return 'matching';
    return 'normalization';
  }, [pathname]);

  const tabs = useMemo(() => {
    const baseTabs: { id: TabId; label: string; icon: React.ReactNode; href: string }[] = [
      { id: 'normalization', label: 'Normalization', icon: <Layers className="w-3.5 h-3.5" />, href: '/workspace' },
      { id: 'matching', label: 'Matching Engine', icon: <Target className="w-3.5 h-3.5" />, href: '/workspace/matching' },
      { id: 'library', label: 'Match Library', icon: <BookOpenText className="w-3.5 h-3.5" />, href: '/workspace/library' },
      { id: 'allocation', label: 'AE Allocation', icon: <UsersRound className="w-3.5 h-3.5" />, href: '/workspace/allocation' },
    ];

    if (currentUser?.role === 'admin') {
      baseTabs.push({ id: 'admin', label: 'Admin', icon: <Shield className="w-3.5 h-3.5" />, href: '/workspace/admin' });
    }

    return baseTabs;
  }, [currentUser?.role]);

  async function handleLogout() {
    try {
      await logout();
    } finally {
      router.replace('/login');
      router.refresh();
    }
  }

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

          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <p className="text-[11px] font-medium" style={{ color: '#080D44' }}>
                {isLoadingUser ? 'Loading...' : currentUser?.username || 'Unknown user'}
              </p>
              <p className="text-[10px] uppercase tracking-[0.08em]" style={{ color: '#6B6B66' }}>
                {isLoadingUser ? '' : currentUser?.role || ''}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="h-8 px-3 text-[11px] rounded-md transition-colors flex items-center gap-1.5"
              style={{ color: '#6B6B66', border: '1px solid #E5E3DC', background: '#FFFFFF' }}
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
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
