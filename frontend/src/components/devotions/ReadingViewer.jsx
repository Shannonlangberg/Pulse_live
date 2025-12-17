import React, { useState, useEffect } from 'react';
import {
  BookOpenIcon,
  HeartIcon,
  PencilIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  ShareIcon,
  BookmarkIcon
} from '@heroicons/react/24/outline';
import DevoCopy from '../utils/devotionCopy';

const ReadingViewer = ({ plan, dayIndex, onClose, onComplete }) => {
  const [fontSize, setFontSize] = useState(18);
  const [theme, setTheme] = useState('dark');
  const [showNotes, setShowNotes] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [noteTags, setNoteTags] = useState([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showHighlights, setShowHighlights] = useState(false);

  // Sample devotion data
  const devotionData = {
    scripture_ref: "Psalm 1:1-3 (NIV)",
    scripture_text: `Blessed is the one who does not walk in step with the wicked or stand in the way that sinners take or sit in the company of mockers, but whose delight is in the law of the Lord, and who meditates on his law day and night. That person is like a tree planted by streams of water, which yields its fruit in season and whose leaf does not wither—whatever they do prospers.`,
    devo_body: `Today we begin our journey through the Psalms. This opening passage sets the foundation for what it means to be blessed by God. Notice how the psalmist contrasts two ways of living: following the world or following God's Word. The imagery of a tree planted by streams of water is powerful - when we root ourselves in God's truth, we find stability and fruitfulness.`,
    media: []
  };

  const themes = {
    dark: 'bg-slate-900 text-white',
    light: 'bg-white text-slate-900',
    sepia: 'bg-amber-50 text-amber-900'
  };

  const handleComplete = () => {
    setIsCompleted(true);
    onComplete && onComplete(plan.id, dayIndex);
  };

  const handleSaveNote = () => {
    if (noteTitle.trim() && noteBody.trim()) {
      // This would save the note
      console.log('Saving note:', { title: noteTitle, body: noteBody, tags: noteTags });
      alert('Note saved successfully!');
      setShowNotes(false);
      setNoteTitle('');
      setNoteBody('');
      setNoteTags([]);
    }
  };

  const handleAddTag = (tag) => {
    if (tag.trim() && !noteTags.includes(tag.trim())) {
      setNoteTags([...noteTags, tag.trim()]);
    }
  };

  const removeTag = (tagToRemove) => {
    setNoteTags(noteTags.filter(tag => tag !== tagToRemove));
  };

  return (
    <div className={`fixed inset-0 ${themes[theme]} overflow-y-auto z-50`}>
      {/* Header */}
      <div className={`sticky top-0 ${theme === 'dark' ? 'bg-slate-800' : theme === 'light' ? 'bg-gray-100' : 'bg-amber-100'} border-b ${theme === 'dark' ? 'border-slate-700' : theme === 'light' ? 'border-gray-200' : 'border-amber-200'} p-4`}>
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center space-x-4">
            <button
              onClick={onClose}
              className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-slate-700' : theme === 'light' ? 'hover:bg-gray-200' : 'hover:bg-amber-200'}`}
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            
            <div>
              <h1 className="font-semibold text-lg">{plan?.title}</h1>
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : theme === 'light' ? 'text-slate-600' : 'text-amber-700'}`}>
                Day {dayIndex}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Font Size Controls */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setFontSize(Math.max(14, fontSize - 2))}
                className={`px-2 py-1 rounded ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600' : theme === 'light' ? 'bg-gray-200 hover:bg-gray-300' : 'bg-amber-200 hover:bg-amber-300'}`}
              >
                A-
              </button>
              <span className={`text-sm ${theme === 'dark' ? 'text-slate-300' : theme === 'light' ? 'text-slate-600' : 'text-amber-700'}`}>
                {fontSize}px
              </span>
              <button
                onClick={() => setFontSize(Math.min(32, fontSize + 2))}
                className={`px-2 py-1 rounded ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600' : theme === 'light' ? 'bg-gray-200 hover:bg-gray-300' : 'bg-amber-200 hover:bg-amber-300'}`}
              >
                A+
              </button>
            </div>

            {/* Theme Toggle */}
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className={`px-3 py-1 rounded border ${theme === 'dark' ? 'bg-slate-700 border-slate-600' : theme === 'light' ? 'bg-white border-gray-300' : 'bg-amber-100 border-amber-300'}`}
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="sepia">Sepia</option>
            </select>

            {/* Notes Toggle */}
            <button
              onClick={() => setShowNotes(!showNotes)}
              className={`p-2 rounded-lg ${showNotes ? 'bg-purple-600 text-white' : theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600' : theme === 'light' ? 'bg-gray-200 hover:bg-gray-300' : 'bg-amber-200 hover:bg-amber-300'}`}
            >
              <PencilIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Reading Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Scripture */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <BookOpenIcon className="w-5 h-5 text-blue-500" />
                <h2 className="text-lg font-semibold">{DevoCopy.scripture}</h2>
              </div>
              
              <div className={`p-6 rounded-xl ${theme === 'dark' ? 'bg-slate-800' : theme === 'light' ? 'bg-gray-100' : 'bg-amber-100'} border ${theme === 'dark' ? 'border-slate-700' : theme === 'light' ? 'border-gray-200' : 'border-amber-200'}`}>
                <h3 className="font-medium mb-4">{devotionData.scripture_ref}</h3>
                <div 
                  className="leading-relaxed"
                  style={{ fontSize: `${fontSize}px` }}
                >
                  {devotionData.scripture_text}
                </div>
              </div>
            </div>

            {/* Devotional Content */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <HeartIcon className="w-5 h-5 text-purple-500" />
                <h2 className="text-lg font-semibold">{DevoCopy.devotional}</h2>
              </div>
              
              <div 
                className={`leading-relaxed ${theme === 'dark' ? 'text-slate-300' : theme === 'light' ? 'text-slate-700' : 'text-amber-800'}`}
                style={{ fontSize: `${fontSize}px` }}
              >
                {devotionData.devo_body}
              </div>
            </div>

            {/* Media (if any) */}
            {devotionData.media && devotionData.media.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Media</h3>
                {devotionData.media.map((item, index) => (
                  <div key={index} className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                    {item.type === 'audio' && (
                      <button className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-500 transition-colors">
                        🎵 Play Audio
                      </button>
                    )}
                    {item.type === 'video' && (
                      <button className="w-full bg-red-600 text-white py-3 rounded-lg hover:bg-red-500 transition-colors">
                        🎬 Play Video
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-slate-700">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowHighlights(!showHighlights)}
                  className={`p-2 rounded-lg ${showHighlights ? 'bg-yellow-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
                >
                  <BookmarkIcon className="w-5 h-5" />
                </button>
                
                <button className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300">
                  <ShareIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center space-x-3">
                {!isCompleted ? (
                  <button
                    onClick={handleComplete}
                    className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-500 transition-colors flex items-center space-x-2"
                  >
                    <CheckIcon className="w-5 h-5" />
                    <span>Mark Complete</span>
                  </button>
                ) : (
                  <div className="flex items-center space-x-2 text-green-400">
                    <CheckIcon className="w-5 h-5" />
                    <span>Completed!</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Notes Panel */}
          {showNotes && (
            <div className={`p-6 rounded-xl ${theme === 'dark' ? 'bg-slate-800' : theme === 'light' ? 'bg-gray-100' : 'bg-amber-100'} border ${theme === 'dark' ? 'border-slate-700' : theme === 'light' ? 'border-gray-200' : 'border-amber-200'}`}>
              <h3 className="text-lg font-semibold mb-4">{DevoCopy.notes}</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Title</label>
                  <input
                    type="text"
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    placeholder="Note title..."
                    className={`w-full px-3 py-2 rounded-lg border ${
                      theme === 'dark' 
                        ? 'bg-slate-700 border-slate-600 text-white' 
                        : theme === 'light' 
                        ? 'bg-white border-gray-300 text-slate-900'
                        : 'bg-amber-50 border-amber-300 text-amber-900'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Your Thoughts</label>
                  <textarea
                    value={noteBody}
                    onChange={(e) => setNoteBody(e.target.value)}
                    placeholder="Write your reflections..."
                    rows="6"
                    className={`w-full px-3 py-2 rounded-lg border ${
                      theme === 'dark' 
                        ? 'bg-slate-700 border-slate-600 text-white' 
                        : theme === 'light' 
                        ? 'bg-white border-gray-300 text-slate-900'
                        : 'bg-amber-50 border-amber-300 text-amber-900'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Tags</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {noteTags.map((tag, index) => (
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
                      className={`flex-1 px-3 py-2 rounded-lg border ${
                        theme === 'dark' 
                          ? 'bg-slate-700 border-slate-600 text-white' 
                          : theme === 'light' 
                          ? 'bg-white border-gray-300 text-slate-900'
                          : 'bg-amber-50 border-amber-300 text-amber-900'
                      }`}
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

                <button
                  onClick={handleSaveNote}
                  className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-500 transition-colors"
                >
                  {DevoCopy.saveNote}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReadingViewer;
