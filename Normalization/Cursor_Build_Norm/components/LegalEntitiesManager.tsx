'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Building2, Plus, Trash2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  loadLegalEntities,
  addLegalEntitiesBulk,
  removeLegalEntity,
  LEGAL_ENTITIES_EVENT,
} from '@/lib/storage';
import { cleanPunctuation } from '@/lib/utils';

export const LegalEntitiesManager: React.FC = () => {
  const [entities, setEntities] = useState<string[]>([]);
  const [newEntities, setNewEntities] = useState('');
  const [duplicateMessage, setDuplicateMessage] = useState<string>('');
  
  useEffect(() => {
    loadData();
    
    const handler = () => loadData();
    if (typeof window !== 'undefined') {
      window.addEventListener(LEGAL_ENTITIES_EVENT, handler);
      return () => {
        window.removeEventListener(LEGAL_ENTITIES_EVENT, handler);
      };
    }
  }, []);
  
  const loadData = () => {
    const loaded = loadLegalEntities();
    setEntities(loaded);
  };
  
  const handleAdd = () => {
    if (!newEntities.trim()) {
      return;
    }
    
    // Clean punctuation and split by comma
    const entitiesToAdd = newEntities
      .split(',')
      .map(e => cleanPunctuation(e.trim()))
      .filter(Boolean);
    
    if (entitiesToAdd.length === 0) {
      return;
    }
    
    // Check for duplicates
    const existingSet = new Set(entities.map(e => e.toUpperCase()));
    const duplicates = entitiesToAdd.filter(e => existingSet.has(e.toUpperCase()));
    const newItems = entitiesToAdd.filter(e => !existingSet.has(e.toUpperCase()));
    
    if (duplicates.length > 0) {
      setDuplicateMessage(`Already exists: ${duplicates.join(', ')}`);
      setTimeout(() => setDuplicateMessage(''), 4000);
    }
    
    if (newItems.length > 0) {
      addLegalEntitiesBulk(newItems);
      loadData();
    }
    
    setNewEntities('');
  };
  
  const handleRemove = (entity: string) => {
    removeLegalEntity(entity);
    loadData();
  };
  
  return (
    <Card variant="obsidian">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Building2 className="w-5 h-5 text-electric-cyan" />
          <CardTitle className="text-sm">Legal Entity & Exclusion List</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-gray-500">
          Manage suffixes and custom exclusion terms that should be stripped from company names (e.g., LLC, Inc., Corp, HOLDINGS).
        </p>
        
        {/* Duplicate Warning */}
        <AnimatePresence>
          {duplicateMessage && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded text-amber-400 text-xs"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {duplicateMessage}
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Add New Form */}
        <div className="border border-obsidian-border rounded p-3">
          <h4 className="text-xs font-medium text-gray-300 mb-2">
            Add Legal Entities or Exclusions
          </h4>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Enter values separated by commas"
              value={newEntities}
              onChange={(e) => setNewEntities(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleAdd();
                }
              }}
              className="flex-1 text-sm"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={handleAdd}
              disabled={!newEntities.trim()}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10px] text-gray-600 mt-2">
            Punctuation will be automatically removed
          </p>
        </div>
        
        {/* Entities List */}
        <div>
          <h4 className="text-xs font-medium text-gray-300 mb-2">
            Current Entries ({entities.length})
          </h4>
          
          {entities.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-obsidian-border rounded">
              <p className="text-xs text-gray-600">
                No legal entities configured yet
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
              {entities.map((entity, idx) => (
                <div
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-obsidian-hover border border-obsidian-border text-xs"
                >
                  <span className="font-medium text-gray-300">
                    {entity}
                  </span>
                  <button
                    onClick={() => handleRemove(entity)}
                    className="text-gray-600 hover:text-neon-red transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Default Entities Info */}
        <div className="border-t border-obsidian-border pt-3">
          <p className="text-[10px] text-gray-600">
            <strong className="text-gray-500">Default entries:</strong> LLC, INC, CORPORATION, CORP, LTD, LIMITED, CO, COMPANY, LLP, LP, PLC, SA, GMBH, AG
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
