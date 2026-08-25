'use client';

import { useEffect, useState } from 'react';

export type DecisionKind = 'approve' | 'reject' | 'delete';

interface DecisionModalProps {
  kind: DecisionKind | null;
  entityName: string;
  isSaving: boolean;
  onCancel: () => void;
  onConfirm: (notes: string) => void;
}

const COPY: Record<DecisionKind, { title: string; body: string; cta: string; accent: string }> = {
  approve: {
    title: 'Approve match',
    body: 'The match becomes active and will be returned instantly on future runs. Notes are optional.',
    cta: 'Approve',
    accent: '#2C6E3F',
  },
  reject: {
    title: 'Reject match',
    body: 'Rejections are remembered, so this pairing will not be suggested again. A reason is required.',
    cta: 'Reject',
    accent: '#A12622',
  },
  delete: {
    title: 'Delete match',
    body: 'This is a soft delete: the row is retained and can be restored. A reason is required.',
    cta: 'Delete',
    accent: '#A12622',
  },
};

export default function DecisionModal({
  kind,
  entityName,
  isSaving,
  onCancel,
  onConfirm,
}: DecisionModalProps) {
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setNotes('');
  }, [kind, entityName]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  if (!kind) return null;

  const copy = COPY[kind];
  const notesRequired = kind !== 'approve';
  const canConfirm = !isSaving && (!notesRequired || notes.trim().length > 0);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        aria-label="Cancel"
        onClick={onCancel}
        className="absolute inset-0"
        style={{ background: 'rgba(8,13,68,0.3)' }}
      />
      <div
        className="relative w-full max-w-[440px] rounded-lg p-4"
        style={{ background: '#F4F3EE', border: '1px solid #E5E3DC' }}
      >
        <h2 className="text-[13px] font-medium" style={{ color: '#080D44' }}>
          {copy.title}
        </h2>
        <p className="text-[11px] mt-1" style={{ color: '#6B6B66' }}>
          {entityName}
        </p>
        <p className="text-[11px] mt-2" style={{ color: '#6B6B66' }}>
          {copy.body}
        </p>

        <label className="block mt-3">
          <span className="text-[11px] font-medium" style={{ color: '#080D44' }}>
            Notes{notesRequired ? '' : ' (optional)'}
          </span>
          <textarea
            autoFocus
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            className="mt-1 w-full rounded border px-2 py-1.5 text-[11px]"
            style={{ borderColor: '#E5E3DC', color: '#080D44', background: '#FFFFFF' }}
            placeholder={notesRequired ? 'Why is this the right call?' : 'Anything worth recording'}
          />
        </label>

        {notesRequired && notes.trim().length === 0 && (
          <p className="text-[10px] mt-1" style={{ color: '#B8860B' }}>
            A reason is required before you can {kind}.
          </p>
        )}

        <div className="flex items-center justify-end gap-2 mt-3">
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="h-9 px-4 rounded-full text-[12px] font-medium disabled:opacity-50"
            style={{ background: 'transparent', color: '#080D44', border: '1px solid #E5E3DC' }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(notes.trim())}
            disabled={!canConfirm}
            className="h-9 px-5 rounded-full text-[12px] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: copy.accent, color: '#F4F3EE' }}
          >
            {isSaving ? 'Saving…' : copy.cta}
          </button>
        </div>
      </div>
    </div>
  );
}
