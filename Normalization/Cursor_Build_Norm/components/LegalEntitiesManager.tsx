'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Badge } from './ui/Badge';
import { Building2, Plus, Trash2 } from 'lucide-react';
import {
  loadLegalEntities,
  addLegalEntitiesBulk,
  removeLegalEntity,
  LEGAL_ENTITIES_EVENT,
} from '@/lib/storage';

export const LegalEntitiesManager: React.FC = () => {
  const [entities, setEntities] = useState<string[]>([]);
  const [newEntities, setNewEntities] = useState('');
  
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
    
    const entitiesToAdd = newEntities
      .split(',')
      .map(e => e.trim())
      .filter(Boolean);
    
    if (entitiesToAdd.length === 0) {
      return;
    }
    
    addLegalEntitiesBulk(entitiesToAdd);
    
    setNewEntities('');
    loadData();
  };
  
  const handleRemove = (entity: string) => {
    removeLegalEntity(entity);
    loadData();
  };
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Building2 className="w-6 h-6 text-accent-blue dark:text-accent-cyan" />
          <CardTitle>Legal Entity & Exclusion List</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Manage suffixes and custom exclusion terms that should be stripped from company names (e.g., LLC, Inc., Corp, HOLDINGS).
        </p>
        
        {/* Add New Form */}
        <div className="border border-light-border dark:border-dark-border rounded-lg p-4">
          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
            Add Legal Entities or Exclusions
          </h4>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Enter values separated by commas (e.g., LLC, INC, HOLDINGS)"
              value={newEntities}
              onChange={(e) => setNewEntities(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleAdd();
                }
              }}
              className="flex-1"
            />
            <Button
              variant="primary"
              size="md"
              onClick={handleAdd}
              disabled={!newEntities.trim()}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add
            </Button>
          </div>
        </div>
        
        {/* Entities List */}
        <div>
          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
            Current Entries ({entities.length})
          </h4>
          
          {entities.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-light-border dark:border-dark-border rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                No legal entities configured yet
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {entities.map((entity, idx) => (
                <div
                  key={idx}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 border border-light-border dark:border-dark-border"
                >
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {entity}
                  </span>
                  <button
                    onClick={() => handleRemove(entity)}
                    className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Default Entities Info */}
        <div className="border-t border-light-border dark:border-dark-border pt-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <strong>Default entries included:</strong> LLC, L.L.C., INC, CORPORATION, CORP, LTD, LIMITED, CO, COMPANY, LLP, LP, PLC, SA, GMBH, AG
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

