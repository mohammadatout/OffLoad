'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload, X, FileText } from 'lucide-react';
import Papa from 'papaparse';

interface UploadedFile {
  file: File;
  headers: string[];
  rowCount: number;
}

interface MatchingUploadProps {
  internalFile: UploadedFile | null;
  externalFile: UploadedFile | null;
  internalCol: string;
  externalCol: string;
  onInternalUploaded: (data: UploadedFile | null) => void;
  onExternalUploaded: (data: UploadedFile | null) => void;
  onInternalColChange: (col: string) => void;
  onExternalColChange: (col: string) => void;
}

export default function MatchingUpload({
  internalFile, externalFile, internalCol, externalCol,
  onInternalUploaded, onExternalUploaded, onInternalColChange, onExternalColChange,
}: MatchingUploadProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <UploadCard
        label="External File"
        description="Your source entities to match"
        uploaded={externalFile}
        selectedCol={externalCol}
        onUploaded={onExternalUploaded}
        onColChange={onExternalColChange}
      />
      <UploadCard
        label="Internal File"
        description="Target entities to match against"
        uploaded={internalFile}
        selectedCol={internalCol}
        onUploaded={onInternalUploaded}
        onColChange={onInternalColChange}
      />
    </div>
  );
}

interface UploadCardProps {
  label: string;
  description: string;
  uploaded: UploadedFile | null;
  selectedCol: string;
  onUploaded: (data: UploadedFile | null) => void;
  onColChange: (col: string) => void;
}

function UploadCard({ label, description, uploaded, selectedCol, onUploaded, onColChange }: UploadCardProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    Papa.parse(file, {
      header: true,
      preview: 1,
      complete: (result) => {
        const headers = result.meta.fields || [];
        const rowCount = 0;
        Papa.parse(file, {
          header: true,
          complete: (fullResult) => {
            onUploaded({ file, headers, rowCount: fullResult.data.length });
            const nameCol = headers.find(h =>
              /name|entity|company/i.test(h)
            );
            if (nameCol) onColChange(nameCol);
          },
        });
      },
    });
  }, [onUploaded, onColChange]);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) handleFile(file);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  if (uploaded) {
    return (
      <div className="p-4 rounded-md" style={{ background: '#fff', border: '1px solid #E5E3DC' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" style={{ color: '#0A0A0A' }} />
            <span className="text-[12px] font-medium" style={{ color: '#0A0A0A' }}>{label}</span>
          </div>
          <button onClick={() => onUploaded(null)} className="p-1 rounded hover:bg-gray-100">
            <X className="w-3.5 h-3.5" style={{ color: '#6B6B66' }} />
          </button>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <span className="font-mono text-[11px]" style={{ color: '#0A0A0A' }}>{uploaded.file.name}</span>
          <span className="font-mono text-[10px]" style={{ color: '#6B6B66' }}>
            {uploaded.rowCount.toLocaleString()} rows
          </span>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: '#6B6B66' }}>
            Entity Name Column
          </label>
          <select
            value={selectedCol}
            onChange={(e) => onColChange(e.target.value)}
            className="w-full h-7 px-2 rounded text-[11px] font-mono"
            style={{ border: '1px solid #E5E3DC', background: '#F4F3EE', color: '#0A0A0A' }}
          >
            <option value="">Select column...</option>
            {uploaded.headers.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className="p-6 rounded-md flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors"
      style={{
        background: dragging ? 'rgba(10,10,10,0.03)' : '#fff',
        border: `1px dashed ${dragging ? '#0A0A0A' : '#E5E3DC'}`,
        minHeight: 140,
      }}
    >
      <Upload className="w-5 h-5" style={{ color: '#6B6B66' }} />
      <div className="text-center">
        <p className="text-[12px] font-medium" style={{ color: '#0A0A0A' }}>{label}</p>
        <p className="text-[10px] mt-0.5" style={{ color: '#6B6B66' }}>{description}</p>
      </div>
      <span className="text-[10px]" style={{ color: '#6B6B66' }}>
        Drop CSV or click to browse
      </span>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        onChange={onInputChange}
        className="hidden"
      />
    </div>
  );
}
