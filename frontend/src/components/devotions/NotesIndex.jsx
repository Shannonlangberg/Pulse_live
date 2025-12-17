import React, { useState, useEffect } from 'react';
import {
  MagnifyingGlassIcon,
  PencilIcon,
  TagIcon,
  ShareIcon,
  TrashIcon,
  PlusIcon,
  FunnelIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import DevoCopy from '../utils/devotionCopy';

const NotesIndex = ({ onClose, onOpenNote }) => {
  const [notes, setNotes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [newNote, setNewNote] = useState({
    title: '',
    body: '',
    tags: [],
    planId: '',
    dayIndex: ''
  });

  // Sample notes data
  const sampleNotes = [
    {
      id: '1',
      title: 'Reflection on Psalm 1',
      body: 'This passage really speaks to me about the importance of staying rooted in God\'s Word. I love the tree imagery - it reminds me that spiritual growth takes time and consistent nourishment.',
      tags: ['reflection', 'psalms', 'growth'],
      planId: '1',
      planTitle: 'Daily Devotional',
      dayIndex: 1,
      created_at: '2024-08-15T10:30:00Z',
      is_shared: false,
      share_token: null
    },
    {
      id: '2',
      title: 'John 1 Insights',
      body: 'The concept of Jesus as the Word is so profound. It connects to Genesis 1 where God spoke creation into being. Jesus is that same creative, life-giving Word.',
      tags: ['john', 'creation', 'jesus'],
      planId: '2',
      planTitle: 'Bible Reading Plan',
      dayIndex: 1,
      created_at: '2024-08-14T15:45:00Z',
      is_shared: true,
      share_token: 'abc123'
    },
    {
      id: '3',
      title: 'Prayer Insights',
      body: 'Today I was reminded of the power of persistent prayer. Like the widow in Luke 18, we should never give up on bringing our requests before God.',
      tags: ['prayer', 'persistence', 'luke'],
      planId: null,
      planTitle: null,
      dayIndex: null,
      created_at: '2024-08-13T09:15:00Z',
      is_shared: false,
      share_token: null
    }
  ];

  // Sample plans for filtering
  const plans = [
    { id: '1', title: 'Daily Devotional' },
    { id: '2', title: 'Bible Reading Plan' },
    { id: '3', title: 'Prayer Workshop' }
  ];

  // All available tags
  const allTags = ['reflection', 'psalms', 'growth', 'john', 'creation', 'jesus', 'prayer', 'persistence', 'luke', 'gratitude', 'worship'];

  useEffect(() => {
    setNotes(sampleNotes);
  }, []);

  const filteredNotes = notes.filter(note => {
    const matchesSearch = note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         note.body.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesTags = selectedTags.length === 0 || 
                       selectedTags.some(tag => note.tags.includes(tag));
    
    const matchesPlan = !selectedPlan || note.planId === selectedPlan;
    
    return matchesSearch && matchesTags && matchesPlan;
  });

  const handleAddNote = () => {
    if (newNote.title.trim() && newNote.body.trim()) {
      const note = {
        id: Date.now().toString(),
        ...newNote,
        created_at: new Date().toISOString(),
        is_shared: false,
        share_token: null
      };
      
      setNotes([note, ...notes]);
      setNewNote({ title: '', body: '', tags: [], planId: '', dayIndex: '' });
      setShowAddNote(false);
    }
  };

  const handleEditNote = (note) => {
    setEditingNote(note);
    setNewNote({
      title: note.title,
      body: note.body,
      tags: note.tags,
      planId: note.planId || '',
      dayIndex: note.dayIndex || ''
    });
    setShowAddNote(true);
  };

  const handleUpdateNote = () => {
    if (editingNote && newNote.title.trim() && newNote.body.trim()) {
      setNotes(notes.map(note => 
        note.id === editingNote.id 
          ? { ...note, ...newNote, updated_at: new Date().toISOString() }
          : note
      ));
      
      setEditingNote(null);
      setNewNote({ title: '', body: '', tags: [], planId: '', dayIndex: '' });
      setShowAddNote(false);
    }
  };

  const handleDeleteNote = (noteId) => {
    if (confirm('Are you sure you want to delete this note?')) {
      setNotes(notes.filter(note => note.id !== noteId));
    }
  };

  const handleShareNote = (note) => {
    if (note.is_shared) {
      // Copy share link
      const shareUrl = `${window.location.origin}/notes/${note.id}?token=${note.share_token}`;
      navigator.clipboard.writeText(shareUrl);
      alert('Share link copied to clipboard!');
    } else {
      // Generate share token
      const updatedNote = {
        ...note,
        is_shared: true,
        share_token: Math.random().toString(36).substr(2, 9)
      };
      setNotes(notes.map(n => n.id === note.id ? updatedNote : n));
      alert('Note is now shared!');
    }
  };

  const handleAddTag = (tag) => {
    if (tag.trim() && !newNote.tags.includes(tag.trim())) {
      setNewNote({ ...newNote, tags: [...newNote.tags, tag.trim()] });
    }
  };

  const removeTag = (tagToRemove) => {
    setNewNote({ ...newNote, tags: newNote.tags.filter(tag => tag !== tagToRemove) });
  };

  const toggleTag = (tag) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-white flex items-center">
            <DocumentTextIcon className="w-6 h-6 mr-2 text-blue-400" />
            My Notes
          </h2>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg ${showFilters ? 'bg-blue-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
            >
              <FunnelIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowAddNote(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-500 transition-colors flex items-center space-x-2"
            >
              <PlusIcon className="w-4 h-4" />
              <span>New Note</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="space-y-4 mb-6">
          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={DevoCopy.searchNotes}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-700/50 rounded-lg">
              {/* Plan Filter */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Filter by Plan</label>
                <select
                  value={selectedPlan}
                  onChange={(e) => setSelectedPlan(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white"
                >
                  <option value="">All Plans</option>
                  {plans.map(plan => (
                    <option key={plan.id} value={plan.id}>{plan.title}</option>
                  ))}
                </select>
              </div>

              {/* Tags Filter */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Filter by Tags</label>
                <div className="flex flex-wrap gap-2">
                  {allTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`px-2 py-1 rounded text-sm ${
                        selectedTags.includes(tag)
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Notes List */}
        <div className="space-y-4">
          {filteredNotes.length > 0 ? (
            filteredNotes.map(note => (
              <div key={note.id} className="bg-slate-700/50 rounded-xl p-4 border border-slate-600 hover:border-blue-500 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="font-semibold text-white">{note.title}</h3>
                      {note.is_shared && (
                        <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-xs">
                          Shared
                        </span>
                      )}
                    </div>
                    
                    <p className="text-slate-300 text-sm mb-3 line-clamp-2">
                      {note.body}
                    </p>
                    
                    <div className="flex items-center space-x-4 text-xs text-slate-400">
                      {note.planTitle && (
                        <span>📖 {note.planTitle} • Day {note.dayIndex}</span>
                      )}
                      <span>📅 {new Date(note.created_at).toLocaleDateString()}</span>
                    </div>
                    
                    {/* Tags */}
                    {note.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {note.tags.map(tag => (
                          <span
                            key={tag}
                            className="bg-purple-500/20 text-purple-400 px-2 py-1 rounded text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => handleEditNote(note)}
                      className="p-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-slate-300"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    
                    <button
                      onClick={() => handleShareNote(note)}
                      className={`p-2 rounded-lg ${
                        note.is_shared 
                          ? 'bg-green-600 text-white' 
                          : 'bg-slate-600 hover:bg-slate-500 text-slate-300'
                      }`}
                    >
                      <ShareIcon className="w-4 h-4" />
                    </button>
                    
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="p-2 rounded-lg bg-red-600 hover:bg-red-500 text-white"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <DocumentTextIcon className="w-16 h-16 text-slate-500 mx-auto mb-4" />
              <p className="text-slate-400 text-lg mb-2">
                {searchQuery || selectedTags.length > 0 || selectedPlan 
                  ? DevoCopy.noResults 
                  : DevoCopy.noNotes}
              </p>
              {searchQuery || selectedTags.length > 0 || selectedPlan ? (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedTags([]);
                    setSelectedPlan('');
                  }}
                  className="text-blue-400 hover:text-blue-300"
                >
                  Clear filters
                </button>
              ) : (
                <button
                  onClick={() => setShowAddNote(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-500 transition-colors"
                >
                  Create your first note
                </button>
              )}
            </div>
          )}
        </div>

        {/* Add/Edit Note Modal */}
        {showAddNote && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
            <div className="bg-slate-800 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-white">
                  {editingNote ? 'Edit Note' : 'New Note'}
                </h3>
                <button
                  onClick={() => {
                    setShowAddNote(false);
                    setEditingNote(null);
                    setNewNote({ title: '', body: '', tags: [], planId: '', dayIndex: '' });
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Title</label>
                  <input
                    type="text"
                    value={newNote.title}
                    onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                    placeholder="Note title..."
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Content</label>
                  <textarea
                    value={newNote.body}
                    onChange={(e) => setNewNote({ ...newNote, body: e.target.value })}
                    placeholder="Write your thoughts..."
                    rows="6"
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Plan (optional)</label>
                    <select
                      value={newNote.planId}
                      onChange={(e) => setNewNote({ ...newNote, planId: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                    >
                      <option value="">No plan</option>
                      {plans.map(plan => (
                        <option key={plan.id} value={plan.id}>{plan.title}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Day (optional)</label>
                    <input
                      type="number"
                      value={newNote.dayIndex}
                      onChange={(e) => setNewNote({ ...newNote, dayIndex: e.target.value })}
                      placeholder="Day number"
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Tags</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {newNote.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="bg-purple-600 text-white px-2 py-1 rounded text-sm flex items-center space-x-1"
                      >
                        <span>{tag}</span>
                        <button
                          onClick={() => removeTag(tag)}
                          className="ml-1 hover:bg-purple-700 rounded"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      placeholder="Add tag..."
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleAddTag(e.target.value);
                          e.target.value = '';
                        }
                      }}
                      className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400"
                    />
                    <button
                      onClick={() => {
                        const input = document.querySelector('input[placeholder="Add tag..."]');
                        if (input && input.value.trim()) {
                          handleAddTag(input.value);
                          input.value = '';
                        }
                      }}
                      className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    onClick={() => {
                      setShowAddNote(false);
                      setEditingNote(null);
                      setNewNote({ title: '', body: '', tags: [], planId: '', dayIndex: '' });
                    }}
                    className="px-4 py-2 text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={editingNote ? handleUpdateNote : handleAddNote}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-500 transition-colors"
                  >
                    {editingNote ? 'Update Note' : 'Save Note'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotesIndex;
