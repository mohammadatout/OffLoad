'use client';

import React, { useState } from 'react';
import { AccordionItem } from './ui/Accordion';
import { Switch } from './ui/Switch';
import { Select } from './ui/Select';
import { Button } from './ui/Button';
import { 
  Settings, 
  Sparkles, 
  MapPin, 
  FileText, 
  Files, 
  CheckCircle, 
  XCircle,
  Phone,
  Globe,
  SplitSquareHorizontal,
} from 'lucide-react';
import { ProcessingConfig } from '@/lib/types';

interface ConfigurationPanelProps {
  config: ProcessingConfig;
  onConfigChange: (config: Partial<ProcessingConfig>) => void;
  availableColumns: string[];
  renames: { [originalName: string]: string };
  onRenamesChange: (renames: { [originalName: string]: string }) => void;
  referenceUploadSlot?: React.ReactNode;
  referenceUploadMissing?: boolean;
  showReferenceUploader?: boolean;
}

export const ConfigurationPanel: React.FC<ConfigurationPanelProps> = ({
  config,
  onConfigChange,
  availableColumns,
  renames,
  onRenamesChange,
  referenceUploadSlot,
  referenceUploadMissing,
  showReferenceUploader,
}) => {
  // Accordion state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    cleaning: true,
    parsing: false,
    dataTypes: false,
    validation: false,
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
      
      {/* 2. Parsing */}
      <AccordionItem
        title="Parsing"
        icon={<SplitSquareHorizontal className="w-5 h-5 text-indigo-500" />}
        isOpen={openSections.parsing}
        onToggle={() => toggleSection('parsing')}
      >
        <div className="space-y-6">
            {/* Address Parsing */}
            <div className="flex items-center justify-between">
                <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                    Parsing
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    Parse addresses, compose company + state context, and build Full_Address
                </p>
                </div>
                <Switch
                checked={config.addressParsingEnabled}
                onCheckedChange={(checked) => onConfigChange({ addressParsingEnabled: checked })}
                />
            </div>
            
            {config.addressParsingEnabled && (
                <div className="space-y-4 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-light-border dark:border-dark-border">
                  <div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      Select every column that should be parsed into <strong>Full_Address</strong>. Include suites, landmarks, company + state fragments—anything that enriches the final address string.
                    </p>
                    <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto p-2 border border-dashed border-light-border dark:border-dark-border rounded-lg">
                      {availableColumns.length === 0 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Upload a file to expose available columns.
                        </p>
                      )}
                      {availableColumns.map((col) => (
                        <div
                          key={`address-${col}`}
                          className={`
                            flex items-center gap-2 px-3 py-2 rounded cursor-pointer text-sm transition-colors
                            ${config.addressColumns.includes(col)
                              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-700'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent'}
                          `}
                          onClick={() => toggleColumn(col, config.addressColumns, 'addressColumns')}
                        >
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                              config.addressColumns.includes(col)
                                ? 'bg-indigo-600 border-indigo-600'
                                : 'border-gray-300 dark:border-gray-600'
                            }`}
                          >
                            {config.addressColumns.includes(col) && (
                              <CheckCircle className="w-3 h-3 text-white" />
                            )}
                          </div>
                          <span className="truncate">{col}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Join delimiter
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        value={config.addressDelimiter}
                        onChange={(e) => onConfigChange({ addressDelimiter: e.target.value })}
                        className="flex-1 rounded-lg border border-light-border dark:border-dark-border bg-white dark:bg-dark-bg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-accent-blue dark:focus:ring-accent-cyan focus:border-transparent"
                        placeholder=", "
                      />
                      <div className="flex gap-1">
                        {[
                          ', ',
                          ' - ',
                          ' | ',
                          '; ',
                          ' / ',
                        ].map((preset) => (
                          <Button
                            key={preset}
                            variant="ghost"
                            size="sm"
                            className="text-xs px-2"
                            onClick={() => onConfigChange({ addressDelimiter: preset })}
                          >
                            {preset.trim() || ', '}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
            )}
            
        </div>
      </AccordionItem>

      {/* 2.5 Phone, Website & Document Processing */}
      <AccordionItem
        title="Phone, Website & Links"
        icon={<Phone className="w-5 h-5 text-purple-500" />}
        isOpen={openSections.dataTypes}
        onToggle={() => toggleSection('dataTypes')}
      >
        <div className="space-y-6">
          {/* Phone Normalization */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  Phone Number Normalization
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Standardize phone numbers to a consistent format
                </p>
              </div>
              <Switch
                checked={config.phoneNormalizationEnabled}
                onCheckedChange={(checked) => onConfigChange({ phoneNormalizationEnabled: checked })}
              />
            </div>
            
            {config.phoneNormalizationEnabled && (
              <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg space-y-4 border border-light-border dark:border-dark-border">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Phone Format
                  </label>
                  <Select
                    value={config.phoneFormat}
                    onChange={(e) => onConfigChange({ phoneFormat: e.target.value as any })}
                    options={[
                      { value: 'NATIONAL', label: '(202) 555-1234' },
                      { value: 'E164', label: '+12025551234' },
                      { value: 'INTERNATIONAL', label: '+1 (202) 555-1234' },
                      { value: 'DOTS', label: '202.555.1234' },
                      { value: 'DASHES', label: '202-555-1234' },
                    ]}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Phone Columns
                  </p>
                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                    {availableColumns.map((col) => (
                      <div
                        key={`phone-${col}`}
                        className={`
                          flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-sm
                          ${config.phoneColumns?.includes(col)
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                          }
                        `}
                        onClick={() => toggleColumn(col, config.phoneColumns || [], 'phoneColumns')}
                      >
                        <Phone className="w-3 h-3" />
                        <span className="truncate">{col}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="w-full h-px bg-light-border dark:bg-dark-border" />
          
          {/* Website Normalization */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  Website/URL Normalization
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Strip protocol (http/https), www, and path - keep domain only
                </p>
              </div>
              <Switch
                checked={config.websiteNormalizationEnabled}
                onCheckedChange={(checked) => onConfigChange({ websiteNormalizationEnabled: checked })}
              />
            </div>
            
            {config.websiteNormalizationEnabled && (
              <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg space-y-4 border border-light-border dark:border-dark-border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Extract Domain
                    </p>
                    <p className="text-xs text-gray-500">
                      Create a separate column with just the domain name
                    </p>
                  </div>
                  <Switch
                    checked={config.extractDomain}
                    onCheckedChange={(checked) => onConfigChange({ extractDomain: checked })}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Website Columns
                  </p>
                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                    {availableColumns.map((col) => (
                      <div
                        key={`web-${col}`}
                        className={`
                          flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-sm
                          ${config.websiteColumns?.includes(col)
                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                          }
                        `}
                        onClick={() => toggleColumn(col, config.websiteColumns || [], 'websiteColumns')}
                      >
                        <Globe className="w-3 h-3" />
                        <span className="truncate">{col}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          </div>
      </AccordionItem>

      {/* 3. City & State Validation */}
      <AccordionItem
        title="City & State Validation"
        icon={<MapPin className="w-5 h-5 text-cyan-500" />}
        isOpen={openSections.validation}
        onToggle={() => toggleSection('validation')}
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between">
              <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                  City & State Validation
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                  {config.cityStateValidationEnabled
                  ? 'Validates against your reference CSV'
                  : 'Toggle on to enable reference-based validation'}
              </p>
              </div>
              <Switch
              checked={config.cityStateValidationEnabled}
              onCheckedChange={(checked) => onConfigChange({ cityStateValidationEnabled: checked })}
              />
          </div>

          {config.cityStateValidationEnabled && (
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

          {showReferenceUploader && referenceUploadSlot && (
              <div className="space-y-3">
                  {referenceUploadMissing && (
                      <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-2 text-sm">
                          Reference file required to validate cities and states.
                      </div>
                  )}
                  {referenceUploadSlot}
              </div>
          )}
        </div>
      </AccordionItem>
      
      {/* Deduplication Strategy */}
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
