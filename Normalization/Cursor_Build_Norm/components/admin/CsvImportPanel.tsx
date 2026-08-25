'use client';

import { useState } from 'react';
import ImportResultCard from './ImportResultCard';
import { ImportBatchSummary } from '@/lib/libraryTypes';

interface CsvImportPanelProps {
  title: string;
  description: string;
  requiredColumns?: string[];
  buttonLabel: string;
  resultTitle: string;
  upload: (file: File) => Promise<ImportBatchSummary>;
}

export default function CsvImportPanel({
  title,
  description,
  requiredColumns,
  buttonLabel,
  resultTitle,
  upload,
}: CsvImportPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<ImportBatchSummary | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleUpload() {
    if (!file) return;
    setError('');
    setIsUploading(true);
    try {
      setSummary(await upload(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The import failed.');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section
      className="rounded-md border p-4"
      style={{ borderColor: '#E5E3DC', background: '#FFFFFF' }}
    >
      <h2 className="text-[13px] font-medium" style={{ color: '#080D44' }}>
        {title}
      </h2>
      <p className="text-[11px] mt-1" style={{ color: '#6B6B66' }}>
        {description}
      </p>

      {requiredColumns && requiredColumns.length > 0 && (
        <p className="text-[10px] mt-1.5 font-mono" style={{ color: '#6B6B66' }}>
          Required columns: {requiredColumns.join(', ')}
        </p>
      )}

      {error && (
        <p className="text-[11px] mt-2" style={{ color: '#A12622' }}>
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setSummary(null);
          }}
          className="text-[11px]"
        />
        <button
          onClick={handleUpload}
          disabled={!file || isUploading}
          className="h-9 px-4 rounded-full text-[12px] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: '#080D44', color: '#F4F3EE' }}
        >
          {isUploading ? 'Uploading…' : buttonLabel}
        </button>
      </div>

      <ImportResultCard title={resultTitle} summary={summary} />
    </section>
  );
}
