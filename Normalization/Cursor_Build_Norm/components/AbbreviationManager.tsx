'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Badge } from './ui/Badge';
import { BookText, Plus, Pencil, Trash2, Save, X, Search } from 'lucide-react';
import { Abbreviation } from '@/lib/types';
import {
  loadAbbreviations,
  addAbbreviation,
  updateAbbreviation,
  deleteAbbreviation,
} from '@/lib/storage';

export const AbbreviationManager: React.FC = () => {
  const [abbreviations, setAbbreviations] = useState<Abbreviation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
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
    
    const abbrArray = newAbbreviations
      .split(';')
      .map(s => s.trim())
      .filter(Boolean);
    
    if (abbrArray.length === 0) {
      return;
    }
    
    addAbbreviation(newCompanyName.trim(), abbrArray);
    
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
    
    const abbrArray = editAbbreviations
      .split(';')
      .map(s => s.trim())
      .filter(Boolean);
    
    if (abbrArray.length === 0) {
      return;
    }
    
    updateAbbreviation(editingId, editCompanyName.trim(), abbrArray);
    
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookText className="w-6 h-6 text-accent-blue dark:text-accent-cyan" />
            <CardTitle>Abbreviation Manager</CardTitle>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAdding(true)}
            disabled={isAdding}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add New
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search abbreviations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {/* Add New Form */}
        {isAdding && (
          <div className="border border-light-border dark:border-dark-border rounded-lg p-4 bg-blue-50 dark:bg-blue-900/10">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
              Add New Abbreviation Rule
            </h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Company Name
                </label>
                <Input
                  type="text"
                  placeholder="e.g., International Business Machines"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Abbreviations (separated by semicolons)
                </label>
                <Input
                  type="text"
                  placeholder="e.g., IBM; I.B.M.; I B M"
                  value={newAbbreviations}
                  onChange={(e) => setNewAbbreviations(e.target.value)}
                />
              </div>
              
              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsAdding(false);
                    setNewCompanyName('');
                    setNewAbbreviations('');
                  }}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleAdd}
                  disabled={!newCompanyName.trim() || !newAbbreviations.trim()}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
              </div>
            </div>
          </div>
        )}
        
        {/* Abbreviations List */}
        {filteredAbbreviations.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {searchTerm 
                ? 'No abbreviations found matching your search'
                : 'No abbreviations yet. Add your first abbreviation rule above.'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAbbreviations.map((abbr) => (
              <div
                key={abbr.id}
                className="border border-light-border dark:border-dark-border rounded-lg p-4"
              >
                {editingId === abbr.id ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Company Name
                      </label>
                      <Input
                        type="text"
                        value={editCompanyName}
                        onChange={(e) => setEditCompanyName(e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Abbreviations (separated by semicolons)
                      </label>
                      <Input
                        type="text"
                        value={editAbbreviations}
                        onChange={(e) => setEditAbbreviations(e.target.value)}
                      />
                    </div>
                    
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelEdit}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleSaveEdit}
                        disabled={!editCompanyName.trim() || !editAbbreviations.trim()}
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                          {abbr.companyName}
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {abbr.abbreviations.map((a, idx) => (
                            <Badge key={idx} variant="info">
                              {a}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleStartEdit(abbr)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(abbr.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Updated: {abbr.updatedAt.toLocaleDateString()}
                    </p>
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

