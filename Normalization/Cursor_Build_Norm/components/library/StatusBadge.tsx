'use client';

import { MatchStatus, STATUS_LABELS } from '@/lib/libraryTypes';

const STATUS_COLORS: Record<MatchStatus, { bg: string; fg: string; border: string }> = {
  pending_admin_approval: { bg: '#EEF1FB', fg: '#2B3A8F', border: '#C9D2F0' },
  pending_review: { bg: '#FDF8E8', fg: '#8A6A08', border: '#E5D5A0' },
  active: { bg: '#ECF6EE', fg: '#2C6E3F', border: '#C3E0CC' },
  rejected: { bg: '#FBEDEC', fg: '#A12622', border: '#EBC7C4' },
  deleted: { bg: '#F2F1EE', fg: '#6B6B66', border: '#DEDCD5' },
};

export default function StatusBadge({ status }: { status: MatchStatus }) {
  const palette = STATUS_COLORS[status] ?? STATUS_COLORS.deleted;

  return (
    <span
      className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium whitespace-nowrap"
      style={{
        background: palette.bg,
        color: palette.fg,
        border: `1px solid ${palette.border}`,
      }}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
