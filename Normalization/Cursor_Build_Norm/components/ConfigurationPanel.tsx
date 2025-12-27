'use client';

import React, { useState } from 'react';
import { AccordionItem } from './ui/Accordion';
import { Switch } from './ui/Switch';
import { Select } from './ui/Select';
import { Button } from './ui/Button';
import { ColumnRenamer } from './ColumnRenamer';
import { 
  Settings, 
  Sparkles, 
  MapPin, 
  FileText, 
  Files, 
  CheckCircle, 
  XCircle,
  ArrowRightLeft
} from 'lucide-react';
import { ProcessingConfig } from '@/lib/types';

interface ConfigurationPanelProps {
  config: ProcessingConfig;
  onConfigChange: (config: Partial<ProcessingConfig>) => void;
  availableColumns: string[];
  hasReferenceFile: boolean;
  renames: { [originalName: string]: string };
  onRenamesChange: (renames: { [originalName: string]: string }) => void;
}

export const ConfigurationPanel: React.FC<ConfigurationPanelProps> = ({
  config,
  onConfigChange,
  availableColumns,
  hasReferenceFile,
  renames,
  onRenamesChange,
}) => {
  // Accordion state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    cleaning: true,
    address: false,
    mapping: false,
    dedupe: false,
  });

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Helper for column options
  const columnOptions = availableColumns.map(col => ({ value: col, label: col }));
  const emptyOption = [{ value: '', label: '-- Select Column --' }];

  // Helper for multi-select toggle
  const toggleColumn = (
    column: string, 
    currentList: string[], 
    updateField: keyof ProcessingConfig
  ) => {
    const newSelected = currentList.includes(column)
      ? currentList.filter(c => c !== column)
      : [...currentList, column];
    onConfigChange({ [updateField]: newSelected });
  };

  const selectAll = (updateField: keyof ProcessingConfig) => {
    onConfigChange({ [updateField]: availableColumns });
  };

  const clearAll = (updateField: keyof ProcessingConfig) => {
    onConfigChange({ [updateField]: [] });
  };

  return (
    <div id="configuration" className="space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-6 h-6 text-accent-blue dark:text-accent-cyan" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Configuration
        </h2>
      </div>
      
      {/* 1. Cleaning & Normalization */}
      <AccordionItem
        title="Cleaning & Normalization"
        icon={<Sparkles className="w-5 h-5 text-accent-blue" />}
        isOpen={openSections.cleaning}
        onToggle={() => toggleSection('cleaning')}
      >
        <div className="space-y-6">
           {/* Text Processing */}
           <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
                Text Processing
            </h3>
            
            <div className="flex items-center justify-between">
                <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                    Uppercase Conversion
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    Convert text to uppercase (excludes URLs and emails)
                </p>
                </div>
                <Switch
                checked={config.uppercaseConversion}
                onCheckedChange={(checked) => onConfigChange({ uppercaseConversion: checked })}
                />
            </div>
            
            <div className="flex items-center justify-between">
                <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                    Normalization & Cleanup
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    Remove punctuation and clean up whitespace
                </p>
                </div>
                <Switch
                checked={config.normalizationCleanup}
                onCheckedChange={(checked) => onConfigChange({ normalizationCleanup: checked })}
                />
            </div>
           </div>
           
           <div className="w-full h-px bg-light-border dark:bg-dark-border" />

           {/* Company Name Cleaning */}
           <div className="space-y-4">
             <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
                Entity Cleaning
            </h3>
            
            <div className="flex items-center justify-between">
                <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                    Enable Company Name Cleaning
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    Remove legal entities and replace abbreviations
                </p>
                </div>
                <Switch
                checked={config.companyNameCleaningEnabled}
                onCheckedChange={(checked) => onConfigChange({ companyNameCleaningEnabled: checked })}
                />
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
                Entity name field selection now lives in the <strong>Input Data Preview</strong> header and becomes available after a file upload.
            </p>
            
            {config.companyNameCleaningEnabled && (
                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg space-y-4 border border-light-border dark:border-dark-border">
                    <div className="flex items-center justify-between">
                        <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                            Remove Legal Entities
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Remove LLC, Inc., Corp., etc.
                        </p>
                        </div>
                        <Switch
                        checked={config.removeLegalEntities}
                        onCheckedChange={(checked) => onConfigChange({ removeLegalEntities: checked })}
                        />
                    </div>
                    
                    <div className="flex items-center justify-between">
                        <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                            Replace Abbreviations
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Use custom abbreviation rules
                        </p>
                        </div>
                        <Switch
                        checked={config.replaceAbbreviations}
                        onCheckedChange={(checked) => onConfigChange({ replaceAbbreviations: checked })}
                        />
                    </div>
                </div>
            )}
            
            {/* Columns to Normalize Selection */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-gray-900 dark:text-gray-100">Columns to Normalize</p>
                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => selectAll('selectedColumns')} className="h-6 text-xs">All</Button>
                        <Button variant="ghost" size="sm" onClick={() => clearAll('selectedColumns')} className="h-6 text-xs">None</Button>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border border-light-border dark:border-dark-border rounded-lg">
                    {availableColumns.map((col) => (
                        <div 
                            key={col} 
                            className={`
                                flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-sm
                                ${config.selectedColumns.includes(col) 
                                    ? 'bg-accent-blue/10 text-accent-blue dark:text-accent-cyan' 
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }
                            `}
                            onClick={() => toggleColumn(col, config.selectedColumns, 'selectedColumns')}
                        >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${config.selectedColumns.includes(col) ? 'bg-accent-blue border-accent-blue' : 'border-gray-300 dark:border-gray-600'}`}>
                                {config.selectedColumns.includes(col) && <CheckCircle className="w-3 h-3 text-white" />}
                            </div>
                            <span className="truncate">{col}</span>
                        </div>
                    ))}
                </div>
            </div>
           </div>
        </div>
      </AccordionItem>
      
      {/* 2. Address Intelligence */}
      <AccordionItem
        title="Address Intelligence"
        icon={<MapPin className="w-5 h-5 text-red-500" />}
        isOpen={openSections.address}
        onToggle={() => toggleSection('address')}
      >
        <div className="space-y-6">
            {/* Address Parsing */}
            <div className="flex items-center justify-between">
                <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                    Enable Address Parsing
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    Combine address columns into Full_Address
                </p>
                </div>
                <Switch
                checked={config.addressParsingEnabled}
                onCheckedChange={(checked) => onConfigChange({ addressParsingEnabled: checked })}
                />
            </div>
            
            {config.addressParsingEnabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-light-border dark:border-dark-border">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Address 1 Column
                    </label>
                    <Select
                    value={config.address1Column}
                    onChange={(e) => onConfigChange({ address1Column: e.target.value })}
                    options={[...emptyOption, ...columnOptions]}
                    disabled={availableColumns.length === 0}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Address 2 Column
                    </label>
                    <Select
                    value={config.address2Column}
                    onChange={(e) => onConfigChange({ address2Column: e.target.value })}
                    options={[...emptyOption, ...columnOptions]}
                    disabled={availableColumns.length === 0}
                    />
                </div>
                </div>
            )}
            
            <div className="w-full h-px bg-light-border dark:bg-dark-border" />

            {/* City/State Validation */}
            <div className="flex items-center justify-between">
                <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                    City & State Validation
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    {hasReferenceFile 
                    ? 'Validate against loaded reference data'
                    : 'Requires reference file upload'
                    }
                </p>
                </div>
                <Switch
                checked={config.cityStateValidationEnabled}
                onCheckedChange={(checked) => onConfigChange({ cityStateValidationEnabled: checked })}
                disabled={!hasReferenceFile}
                />
            </div>

            {config.cityStateValidationEnabled && hasReferenceFile && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-light-border dark:border-dark-border">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    City Column
                    </label>
                    <Select
                    value={config.cityColumn}
                    onChange={(e) => onConfigChange({ cityColumn: e.target.value })}
                    options={[...emptyOption, ...columnOptions]}
                    disabled={availableColumns.length === 0}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    State Column
                    </label>
                    <Select
                    value={config.stateColumn}
                    onChange={(e) => onConfigChange({ stateColumn: e.target.value })}
                    options={[...emptyOption, ...columnOptions]}
                    disabled={availableColumns.length === 0}
                    />
                </div>
                </div>
            )}
        </div>
      </AccordionItem>
      
      {/* 3. Column Mapping & Output */}
      <AccordionItem
        title="Column Mapping & Output"
        icon={<ArrowRightLeft className="w-5 h-5 text-purple-500" />}
        isOpen={openSections.mapping}
        onToggle={() => toggleSection('mapping')}
      >
        <div className="space-y-6">
            {/* Output Selection */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">Include in Export (Clean File)</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Select which columns appear in the <strong>Clean Build</strong> export. 
                          This does not affect the Original vs Clean audit file (it always includes every column).
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => selectAll('outputColumns')} className="h-6 text-xs">All</Button>
                        <Button variant="ghost" size="sm" onClick={() => clearAll('outputColumns')} className="h-6 text-xs">None</Button>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border border-light-border dark:border-dark-border rounded-lg">
                    {availableColumns.map((col) => (
                        <div 
                            key={`out-${col}`} 
                            className={`
                                flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-sm
                                ${config.outputColumns.includes(col) 
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }
                            `}
                            onClick={() => toggleColumn(col, config.outputColumns, 'outputColumns')}
                        >
                             <div className={`w-4 h-4 rounded border flex items-center justify-center ${config.outputColumns.includes(col) ? 'bg-green-600 border-green-600' : 'border-gray-300 dark:border-gray-600'}`}>
                                {config.outputColumns.includes(col) && <CheckCircle className="w-3 h-3 text-white" />}
                            </div>
                            <span className="truncate">{col}</span>
                        </div>
                    ))}
                </div>
            </div>
            
            <div className="w-full h-px bg-light-border dark:bg-dark-border" />
            
            {/* Renamer */}
            <ColumnRenamer 
                columns={availableColumns}
                renames={renames}
                onRenamesChange={onRenamesChange}
            />
        </div>
      </AccordionItem>

      {/* 4. Deduplication Strategy */}
      <AccordionItem
        title="Deduplication Strategy"
        icon={<Files className="w-5 h-5 text-orange-500" />}
        isOpen={openSections.dedupe}
        onToggle={() => toggleSection('dedupe')}
      >
         <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Define unique keys for deduplication. Rows with identical values in these columns will be merged.
              If empty, deduplication will use the Company Name column if enabled.
              <br />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Deduplication only impacts the <strong>Clean Build</strong> export. The Original vs Clean audit file always stays row-by-row.
              </span>
            </p>
            
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto p-2 border border-light-border dark:border-dark-border rounded-lg">
                {availableColumns.map((col) => (
                    <div 
                        key={`dup-${col}`} 
                        className={`
                            flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-sm
                            ${config.duplicateDetectionColumns.includes(col) 
                                ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' 
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                            }
                        `}
                        onClick={() => toggleColumn(col, config.duplicateDetectionColumns, 'duplicateDetectionColumns')}
                    >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${config.duplicateDetectionColumns.includes(col) ? 'bg-orange-500 border-orange-500' : 'border-gray-300 dark:border-gray-600'}`}>
                            {config.duplicateDetectionColumns.includes(col) && <CheckCircle className="w-3 h-3 text-white" />}
                        </div>
                        <span className="truncate">{col}</span>
                    </div>
                ))}
            </div>
            
            {config.duplicateDetectionColumns.length > 0 && (
                <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-100 dark:border-orange-900/30">
                    <p className="text-xs text-orange-800 dark:text-orange-300">
                        <strong>Strategy:</strong> Rows will be grouped by <em>{config.duplicateDetectionColumns.join(' + ')}</em>. 
                        Conflicting values in other columns will be merged (concatenated).
                    </p>
                </div>
            )}
         </div>
      </AccordionItem>

    </div>
  );
};
