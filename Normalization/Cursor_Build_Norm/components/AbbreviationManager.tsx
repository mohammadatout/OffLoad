'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Badge } from './ui/Badge';
import { BookText, Plus, Pencil, Trash2, Save, X, Search, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Abbreviation } from '@/lib/types';
import {
  loadAbbreviations,
  addAbbreviation,
  updateAbbreviation,
  deleteAbbreviation,
} from '@/lib/storage';
import { cleanPunctuation } from '@/lib/utils';

export const AbbreviationManager: React.FC = () => {
  const [abbreviations, setAbbreviations] = useState<Abbreviation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [duplicateMessage, setDuplicateMessage] = useState<string>('');
  
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newAbbreviations, setNewAbbreviations] = useState('');
  
  const [editCompanyName, setEditCompanyName] = useState('');
  const [editAbbreviations, setEditAbbreviations] = useState('');
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = () => {
    const loaded = loadAbbreviations();
    setAbbreviations(loaded);
  };
  
  const handleAdd = () => {
    if (!newCompanyName.trim() || !newAbbreviations.trim()) {
      return;
    }
    
    // Clean punctuation from company name and abbreviations
    const cleanedCompanyName = cleanPunctuation(newCompanyName.trim());
    const abbrArray = newAbbreviations
      .split(';')
      .map(s => cleanPunctuation(s.trim()))
      .filter(Boolean);
    
    if (abbrArray.length === 0) {
      return;
    }
    
    // Check for duplicate company name
    const existingCompany = abbreviations.find(
      a => a.companyName.toUpperCase() === cleanedCompanyName.toUpperCase()
    );
    
    if (existingCompany) {
      setDuplicateMessage(`"${cleanedCompanyName}" already exists in the abbreviation list.`);
      setTimeout(() => setDuplicateMessage(''), 4000);
      return;
    }
    
    addAbbreviation(cleanedCompanyName, abbrArray);
    
    setNewCompanyName('');
    setNewAbbreviations('');
    setIsAdding(false);
    loadData();
  };
  
  const handleStartEdit = (abbr: Abbreviation) => {
    setEditingId(abbr.id);
    setEditCompanyName(abbr.companyName);
    setEditAbbreviations(abbr.abbreviations.join('; '));
  };
  
  const handleSaveEdit = () => {
    if (!editingId || !editCompanyName.trim() || !editAbbreviations.trim()) {
      return;
    }
    
    const cleanedCompanyName = cleanPunctuation(editCompanyName.trim());
    const abbrArray = editAbbreviations
      .split(';')
      .map(s => cleanPunctuation(s.trim()))
      .filter(Boolean);
    
    if (abbrArray.length === 0) {
      return;
    }
    
    // Check for duplicate (excluding current entry)
    const existingCompany = abbreviations.find(
      a => a.companyName.toUpperCase() === cleanedCompanyName.toUpperCase() && a.id !== editingId
    );
    
    if (existingCompany) {
      setDuplicateMessage(`"${cleanedCompanyName}" already exists in the abbreviation list.`);
      setTimeout(() => setDuplicateMessage(''), 4000);
      return;
    }
    
    updateAbbreviation(editingId, cleanedCompanyName, abbrArray);
    
    setEditingId(null);
    setEditCompanyName('');
    setEditAbbreviations('');
    loadData();
  };
  
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditCompanyName('');
    setEditAbbreviations('');
  };
  
  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this abbreviation rule?')) {
      deleteAbbreviation(id);
      loadData();
    }
  };
  
  const filteredAbbreviations = abbreviations.filter(abbr => {
    const searchLower = searchTerm.toLowerCase();
    return (
      abbr.companyName.toLowerCase().includes(searchLower) ||
      abbr.abbreviations.some(a => a.toLowerCase().includes(searchLower))
    );
  });
  
  return (
    <Card variant="obsidian">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookText className="w-5 h-5 text-electric-purple" />
            <CardTitle className="text-sm">Abbreviation Manager</CardTitle>
          </div>
          <Button
            variant="primary"
            size="xs"
            onClick={() => setIsAdding(true)}
            disabled={isAdding}
          >
            <Plus className="w-3 h-3 mr-1" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
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

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-500" />
          <Input
            type="text"
            placeholder="Search abbreviations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 text-sm h-8"
          />
        </div>
        
        {/* Add New Form */}
        <AnimatePresence>
          {isAdding && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border border-electric-cyan/30 rounded p-3 bg-electric-cyan/5"
            >
              <h4 className="text-xs font-medium text-gray-300 mb-2">
                Add New Abbreviation Rule
              </h4>
              <p className="text-[10px] text-gray-500 mb-2">
                Punctuation will be automatically removed
              </p>
              <div className="space-y-2">
                <Input
                  type="text"
                  placeholder="Company Name (e.g., International Business Machines)"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="text-sm h-8"
                />
                <Input
                  type="text"
                  placeholder="Abbreviations (semicolon-separated, e.g., IBM; I.B.M.)"
                  value={newAbbreviations}
                  onChange={(e) => setNewAbbreviations(e.target.value)}
                  className="text-sm h-8"
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      setIsAdding(false);
                      setNewCompanyName('');
                      setNewAbbreviations('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="xs"
                    onClick={handleAdd}
                    disabled={!newCompanyName.trim() || !newAbbreviations.trim()}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Abbreviations List */}
        {filteredAbbreviations.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-xs text-gray-600">
              {searchTerm 
                ? 'No abbreviations found'
                : 'No abbreviations yet'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {filteredAbbreviations.map((abbr) => (
              <div
                key={abbr.id}
                className="border border-obsidian-border rounded p-3"
              >
                {editingId === abbr.id ? (
                  <div className="space-y-2">
                    <Input
                      type="text"
                      value={editCompanyName}
                      onChange={(e) => setEditCompanyName(e.target.value)}
                      className="text-sm h-8"
                    />
                    <Input
                      type="text"
                      value={editAbbreviations}
                      onChange={(e) => setEditAbbreviations(e.target.value)}
                      className="text-sm h-8"
                    />
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="xs" onClick={handleCancelEdit}>
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        size="xs"
                        onClick={handleSaveEdit}
                        disabled={!editCompanyName.trim() || !editAbbreviations.trim()}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-200 mb-1">
                          {abbr.companyName}
                        </h4>
                        <div className="flex flex-wrap gap-1">
                          {abbr.abbreviations.map((a, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 text-[10px] bg-electric-purple/20 text-electric-purple rounded"
                            >
                              {a}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-1 ml-2">
                        <button
                          onClick={() => handleStartEdit(abbr)}
                          className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(abbr.id)}
                          className="p-1 text-gray-500 hover:text-neon-red transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
