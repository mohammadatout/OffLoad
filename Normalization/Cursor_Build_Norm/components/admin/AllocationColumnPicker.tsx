'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Columns, RotateCcw } from 'lucide-react';
import {
  fetchAllocationColumns,
  resetAllocationColumns,
  saveAllocationColumns,
} from '@/lib/libraryApi';
import { AllocationColumnSettings } from '@/lib/libraryTypes';

/**
 * Which columns the AE Allocation table shows. The choice is global, so one
 * admin sets it and every reviewer sees the same table.
 */
export default function AllocationColumnPicker() {
  const [settings, setSettings] = useState<AllocationColumnSettings | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchAllocationColumns()
      .then((next) => {
        setSettings(next);
        setSelected(next.selected);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load columns.')
      );
  }, []);

  const grouped = useMemo(() => {
    const groups = new Map<string, { key: string; label: string }[]>();
    (settings?.available ?? []).forEach((column) => {
      const list = groups.get(column.group) ?? [];
      list.push({ key: column.key, label: column.label });
      groups.set(column.group, list);
    });
    return [...groups.entries()];
  }, [settings]);

  const isDirty =
    settings != null && JSON.stringify(selected) !== JSON.stringify(settings.selected);

  function toggle(key: string) {
    setMessage('');
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  }

  function move(key: string, direction: -1 | 1) {
    setMessage('');
    setSelected((prev) => {
      const index = prev.indexOf(key);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function save() {
    setIsSaving(true);
    setError('');
    setMessage('');
    try {
      const saved = await saveAllocationColumns(selected);
      setSettings(saved);
      setSelected(saved.selected);
      setMessage(`Saved. AE Allocation now shows ${saved.selected.length} columns.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save columns.');
    } finally {
      setIsSaving(false);
    }
  }

  async function restoreDefaults() {
    setIsSaving(true);
    setError('');
    setMessage('');
    try {
      const saved = await resetAllocationColumns();
      setSettings(saved);
      setSelected(saved.selected);
      setMessage('Restored the default column set.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset columns.');
    } finally {
      setIsSaving(false);
    }
  }

  const labelOf = (key: string) =>
    settings?.available.find((column) => column.key === key)?.label ?? key;

  return (
    <section
      className="rounded-md border p-4"
      style={{ borderColor: '#E5E3DC', background: '#FFFFFF' }}
    >
      <h2
        className="text-[13px] font-medium inline-flex items-center gap-1.5"
        style={{ color: '#080D44' }}
      >
        <Columns className="w-3.5 h-3.5" />
        AE Allocation columns
      </h2>
      <p className="text-[11px] mt-1" style={{ color: '#6B6B66' }}>
        Pick which columns the AE Allocation table shows and the order they appear in. This
        applies to everyone, and the download uses the same set on its front sheet.
      </p>

      {error && (
        <p className="text-[11px] mt-2" style={{ color: '#A12622' }}>
          {error}
        </p>
      )}
      {message && (
        <p className="text-[11px] mt-2" style={{ color: '#2C6E3F' }}>
          {message}
        </p>
      )}

      {settings == null ? (
        <p className="text-[11px] mt-3" style={{ color: '#6B6B66' }}>
          Loading columns…
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <p
              className="text-[10px] uppercase tracking-[0.06em] mb-1.5"
              style={{ color: '#6B6B66' }}
            >
              Available ({settings.available.length})
            </p>
            <div
              className="rounded border max-h-[320px] overflow-y-auto p-2 space-y-2"
              style={{ borderColor: '#E5E3DC' }}
            >
              {grouped.map(([group, columns]) => (
                <div key={group}>
                  <p className="text-[10px] font-medium" style={{ color: '#6B6B66' }}>
                    {group}
                  </p>
                  {columns.map((column) => (
                    <label
                      key={column.key}
                      className="flex items-center gap-2 text-[11px] py-0.5 cursor-pointer"
                      style={{ color: '#080D44' }}
                    >
                      <input
                        type="checkbox"
                        checked={selected.includes(column.key)}
                        onChange={() => toggle(column.key)}
                      />
                      {column.label}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div>
            <p
              className="text-[10px] uppercase tracking-[0.06em] mb-1.5"
              style={{ color: '#6B6B66' }}
            >
              Shown, in order ({selected.length})
            </p>
            <div
              className="rounded border max-h-[320px] overflow-y-auto"
              style={{ borderColor: '#E5E3DC' }}
            >
              {selected.length === 0 && (
                <p className="text-[11px] p-2" style={{ color: '#A12622' }}>
                  At least one column must stay visible.
                </p>
              )}
              {selected.map((key, index) => (
                <div
                  key={key}
                  className="flex items-center gap-1.5 px-2 py-1 border-b text-[11px]"
                  style={{ borderColor: '#F0EEE9', color: '#080D44' }}
                >
                  <span className="w-5 text-right font-mono" style={{ color: '#6B6B66' }}>
                    {index + 1}
                  </span>
                  <span className="flex-1 truncate">{labelOf(key)}</span>
                  <button
                    onClick={() => move(key, -1)}
                    disabled={index === 0}
                    className="h-6 w-6 rounded inline-flex items-center justify-center disabled:opacity-30"
                    style={{ border: '1px solid #E5E3DC', color: '#6B6B66' }}
                    aria-label={`Move ${labelOf(key)} up`}
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => move(key, 1)}
                    disabled={index === selected.length - 1}
                    className="h-6 w-6 rounded inline-flex items-center justify-center disabled:opacity-30"
                    style={{ border: '1px solid #E5E3DC', color: '#6B6B66' }}
                    aria-label={`Move ${labelOf(key)} down`}
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={save}
          disabled={isSaving || selected.length === 0 || !isDirty}
          className="h-9 px-4 rounded-full text-[12px] font-medium disabled:opacity-50"
          style={{ background: '#080D44', color: '#F4F3EE' }}
        >
          {isSaving ? 'Saving…' : 'Save columns'}
        </button>
        <button
          onClick={restoreDefaults}
          disabled={isSaving || (settings?.is_default ?? true)}
          className="h-9 px-3 rounded-full text-[12px] font-medium inline-flex items-center gap-1 disabled:opacity-50"
          style={{ background: 'transparent', color: '#080D44', border: '1px solid #E5E3DC' }}
        >
          <RotateCcw className="w-3 h-3" />
          Reset to default
        </button>
      </div>
    </section>
  );
}
