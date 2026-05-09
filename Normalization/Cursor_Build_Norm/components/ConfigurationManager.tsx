'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Badge } from './ui/Badge';
import { Alert } from './ui/Alert';
import {
  Save,
  FolderOpen,
  Download,
  Upload,
  Trash2,
  Clock,
  User,
  FileText,
  X,
  Check,
  Copy,
  Settings,
  ChevronDown,
  ChevronRight,
  Bookmark,
} from 'lucide-react';
import { ProcessingConfig, SavedConfiguration } from '@/lib/types';
import {
  loadSavedConfigurations,
  saveConfiguration,
  deleteSavedConfiguration,
  exportConfigurationToJSON,
  importConfigurationFromJSON,
  SAVED_CONFIGS_EVENT,
} from '@/lib/storage';

interface ConfigurationManagerProps {
  currentConfig: ProcessingConfig;
  onLoadConfiguration: (config: ProcessingConfig) => void;
}

export const ConfigurationManager: React.FC<ConfigurationManagerProps> = ({
  currentConfig,
  onLoadConfiguration,
}) => {
  const [savedConfigs, setSavedConfigs] = useState<SavedConfiguration[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadConfigs();
    
    const handler = () => loadConfigs();
    if (typeof window !== 'undefined') {
      window.addEventListener(SAVED_CONFIGS_EVENT, handler);
      return () => window.removeEventListener(SAVED_CONFIGS_EVENT, handler);
    }
  }, []);

  const loadConfigs = () => {
    const configs = loadSavedConfigurations();
    setSavedConfigs(configs);
  };

  const handleSave = () => {
    if (!saveName.trim()) {
      setError('Please enter a name for this configuration');
      return;
    }
    
    try {
      saveConfiguration(saveName.trim(), currentConfig, saveDescription.trim());
      setSaveName('');
      setSaveDescription('');
      setIsSaveModalOpen(false);
      setSuccessMessage('Configuration saved successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      loadConfigs();
    } catch (err) {
      setError('Failed to save configuration');
    }
  };

  const handleLoad = (config: SavedConfiguration) => {
    onLoadConfiguration(config.config);
    setSuccessMessage(`Loaded "${config.name}" configuration`);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      deleteSavedConfiguration(id);
      loadConfigs();
    }
  };

  const handleExport = (config: SavedConfiguration) => {
    const json = exportConfigurationToJSON(config);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${config.name.replace(/\s+/g, '_')}_config.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportCurrent = () => {
    const tempConfig: SavedConfiguration = {
      id: 'temp',
      name: 'Current Configuration',
      createdAt: new Date(),
      updatedAt: new Date(),
      config: currentConfig,
    };
    handleExport(tempConfig);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = e.target?.result as string;
        const imported = importConfigurationFromJSON(json);
        
        if (imported) {
          // Save the imported config
          saveConfiguration(
            imported.name,
            imported.config,
            imported.description
          );
          loadConfigs();
          setSuccessMessage('Configuration imported successfully!');
          setTimeout(() => setSuccessMessage(''), 3000);
        } else {
          setError('Invalid configuration file format');
        }
      } catch (err) {
        setError('Failed to import configuration');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleCopyToClipboard = (config: SavedConfiguration) => {
    const json = exportConfigurationToJSON(config);
    navigator.clipboard.writeText(json);
    setSuccessMessage('Configuration copied to clipboard!');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  return (
    <Card>
      <CardHeader>
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-app-active-bg border border-app-border">
              <Bookmark className="w-5 h-5 text-app-text" strokeWidth={1.5} />
            </div>
            <div>
              <CardTitle className="text-base">Saved Configurations</CardTitle>
              <p className="text-xs text-app-muted dark:text-gray-400">
                {savedConfigs.length} saved • Save & share with your team
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex shrink-0 items-center justify-center gap-1 h-8 px-3 rounded-full text-[11px] font-medium bg-[#0A0A0A] text-white hover:bg-[#1a1a1a] transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setIsSaveModalOpen(true);
              }}
            >
              <Save className="w-3.5 h-3.5" strokeWidth={2} />
              Save Current
            </button>
            {isExpanded ? (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-500" />
            )}
          </div>
        </div>
      </CardHeader>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="space-y-4 pt-0">
              {successMessage && (
                <Alert variant="success">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    {successMessage}
                  </div>
                </Alert>
              )}

              {error && (
                <Alert variant="danger">
                  {error}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-2"
                    onClick={() => setError('')}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </Alert>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4 mr-1" />
                  Import
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCurrent}
                >
                  <Download className="w-4 h-4 mr-1" />
                  Export Current
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
              </div>

              {/* Saved Configurations List */}
              {savedConfigs.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-light-border dark:border-dark-border rounded-lg">
                  <Settings className="w-10 h-10 mx-auto mb-3 text-gray-400" />
                  <p className="text-gray-500 dark:text-gray-400">
                    No saved configurations yet
                  </p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                    Save your current settings to reuse later
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {savedConfigs.map((config) => (
                    <motion.div
                      key={config.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="p-3 rounded-lg border border-light-border dark:border-dark-border bg-gray-50 dark:bg-gray-800/50 hover:border-app-text/30 dark:hover:border-gray-500 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                            <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                              {config.name}
                            </h4>
                          </div>
                          {config.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                              {config.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(config.updatedAt).toLocaleDateString()}
                            </span>
                            {config.createdBy && (
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {config.createdBy}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleLoad(config)}
                            className="text-app-text hover:bg-app-hover"
                          >
                            <FolderOpen className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyToClipboard(config)}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleExport(config)}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(config.id, config.name)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/30"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save Modal */}
      <AnimatePresence>
        {isSaveModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setIsSaveModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-dark-card rounded-xl shadow-2xl w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Save Configuration
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsSaveModalOpen(false)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Configuration Name *
                  </label>
                  <Input
                    type="text"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder="e.g., Customer Data Cleanup"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description (optional)
                  </label>
                  <textarea
                    value={saveDescription}
                    onChange={(e) => setSaveDescription(e.target.value)}
                    placeholder="Describe what this configuration is used for..."
                    className="w-full px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-gray-100 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-accent-blue"
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    variant="ghost"
                    onClick={() => setIsSaveModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleSave}
                    disabled={!saveName.trim()}
                  >
                    <Save className="w-4 h-4 mr-1" />
                    Save
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
};

