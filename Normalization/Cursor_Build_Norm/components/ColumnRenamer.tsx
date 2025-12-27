'use client';

import React, { useState } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Pencil, Check, X } from 'lucide-react';

interface ColumnRenamerProps {
  columns: string[];
  renames: { [originalName: string]: string };
  onRenamesChange: (renames: { [originalName: string]: string }) => void;
}

export const ColumnRenamer: React.FC<ColumnRenamerProps> = ({
  columns,
  renames,
  onRenamesChange,
}) => {
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');
  
  const handleStartEdit = (column: string) => {
    setEditingColumn(column);
    setTempName(renames[column] || column);
  };
  
  const handleSaveEdit = (column: string) => {
    if (tempName.trim() && tempName !== column) {
      onRenamesChange({ ...renames, [column]: tempName.trim() });
    } else {
      // Remove rename if set back to original
      const newRenames = { ...renames };
      delete newRenames[column];
      onRenamesChange(newRenames);
    }
    setEditingColumn(null);
    setTempName('');
  };
  
  const handleCancelEdit = () => {
    setEditingColumn(null);
    setTempName('');
  };
  
  const handleClearAll = () => {
    onRenamesChange({});
  };
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Rename columns in the output file. Original names are used during processing.
          </p>
          {Object.keys(renames).length > 0 && (
            <Button variant="outline" size="sm" onClick={handleClearAll}>
              Clear All
            </Button>
          )}
      </div>
      
      {columns.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center py-4">
          Upload a CSV file to rename columns
        </p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
          {columns.map((column) => (
            <div
              key={column}
              className="flex items-center gap-3 p-3 rounded-lg border border-light-border dark:border-dark-border bg-white dark:bg-dark-bg"
            >
              {editingColumn === column ? (
                <>
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Original</p>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                        {column}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">New Name</p>
                      <Input
                        type="text"
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveEdit(column);
                          } else if (e.key === 'Escape') {
                            handleCancelEdit();
                          }
                        }}
                        className="h-8"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSaveEdit(column)}
                      className="h-8 w-8 p-0 hover:bg-green-100 dark:hover:bg-green-900/30"
                    >
                      <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelEdit}
                      className="h-8 w-8 p-0 hover:bg-red-100 dark:hover:bg-red-900/30"
                    >
                      <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {column}
                    </p>
                    {renames[column] && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                        → {renames[column]}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleStartEdit(column)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
