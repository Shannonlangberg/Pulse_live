import React, { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

const DesignSettingsPanel = ({ settings, onChange, onFormat, hasSelection }) => {
  const [expandedSections, setExpandedSections] = useState({
    emailBody: true,
    fonts: true
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const updateSetting = (key, value) => {
    onChange({
      ...settings,
      [key]: value
    });
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 p-6 overflow-y-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-gray-400 text-xs">Content</span>
          <span className="text-gray-900 font-semibold text-sm">Design</span>
        </div>
      </div>

      {/* EMAIL BODY & BACKGROUND */}
      <div className="mb-4">
        <button
          onClick={() => toggleSection('emailBody')}
          className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
        >
          <span className="text-gray-900 font-semibold text-xs uppercase tracking-wide">EMAIL BODY & BACKGROUND</span>
          {expandedSections.emailBody ? (
            <ChevronUpIcon className="w-4 h-4 text-gray-600" />
          ) : (
            <ChevronDownIcon className="w-4 h-4 text-gray-600" />
          )}
        </button>

        {expandedSections.emailBody && (
          <div className="mt-3 space-y-4 p-3">
            {/* Email Width */}
            <div>
              <label className="block text-gray-700 text-xs font-medium mb-2">Email Width</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={settings.emailWidth}
                  onChange={(e) => updateSetting('emailWidth', parseInt(e.target.value) || 567)}
                  className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <label className="flex items-center gap-2 text-gray-700 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.evenColumns}
                    onChange={(e) => updateSetting('evenColumns', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  Even Columns
                </label>
              </div>
            </div>

            {/* Full width on mobile */}
            <div>
              <label className="flex items-center gap-2 text-gray-700 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.fullWidthMobile}
                  onChange={(e) => updateSetting('fullWidthMobile', e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                Full width on mobile
              </label>
            </div>

            {/* Grid Width */}
            <div>
              <label className="block text-gray-700 text-xs font-medium mb-2">Grid Width</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={settings.gridWidth}
                  onChange={(e) => updateSetting('gridWidth', parseInt(e.target.value) || 25)}
                  className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <label className="flex items-center gap-2 text-gray-700 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.useGrid}
                    onChange={(e) => updateSetting('useGrid', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  Use Grid
                </label>
              </div>
            </div>

            {/* Border */}
            <div>
              <label className="block text-gray-700 text-xs font-medium mb-2">Border</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.borderColor}
                  onChange={(e) => updateSetting('borderColor', e.target.value)}
                  className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={settings.borderColor}
                  onChange={(e) => updateSetting('borderColor', e.target.value)}
                  className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <input
                  type="number"
                  value={settings.borderWidth}
                  onChange={(e) => updateSetting('borderWidth', parseInt(e.target.value) || 0)}
                  className="w-20 px-3 py-2 bg-white border border-gray-300 rounded text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Background Colour */}
            <div>
              <label className="block text-gray-700 text-xs font-medium mb-2 flex items-center gap-1">
                Background Colour
                <span className="text-gray-400 cursor-help" title="Background color for the email">?</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.backgroundColor}
                  onChange={(e) => updateSetting('backgroundColor', e.target.value)}
                  className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={settings.backgroundColor}
                  onChange={(e) => updateSetting('backgroundColor', e.target.value)}
                  className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Full height background */}
            <div>
              <label className="flex items-center gap-2 text-gray-700 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.fullHeightBackground}
                  onChange={(e) => updateSetting('fullHeightBackground', e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                Full height background colour
              </label>
            </div>

            {/* Background Image */}
            <div>
              <label className="block text-gray-700 text-xs font-medium mb-2 flex items-center gap-1">
                Background Image
                <span className="text-gray-400 cursor-help" title="Background image for the email">?</span>
              </label>
              <input
                type="text"
                value={settings.backgroundImage || ''}
                onChange={(e) => updateSetting('backgroundImage', e.target.value)}
                placeholder="Select Image"
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        )}
      </div>

      {/* DEFAULT FONTS */}
      <div>
        <button
          onClick={() => toggleSection('fonts')}
          className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
        >
          <span className="text-gray-900 font-semibold text-xs uppercase tracking-wide">DEFAULT FONTS</span>
          {expandedSections.fonts ? (
            <ChevronUpIcon className="w-4 h-4 text-gray-600" />
          ) : (
            <ChevronDownIcon className="w-4 h-4 text-gray-600" />
          )}
        </button>

        {expandedSections.fonts && (
          <div className="mt-3 space-y-4 p-3">
            {/* Body Text */}
            <div>
              <label className="block text-gray-700 text-xs font-medium mb-2">Body Text</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.bodyTextColor}
                  onChange={(e) => updateSetting('bodyTextColor', e.target.value)}
                  className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                />
                <select
                  value={settings.bodyFont}
                  onChange={(e) => updateSetting('bodyFont', e.target.value)}
                  className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="Arial">Arial</option>
                  <option value="Helvetica">Helvetica</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Verdana">Verdana</option>
                  <option value="Courier New">Courier New</option>
                </select>
                <input
                  type="number"
                  value={settings.bodyFontSize}
                  onChange={(e) => updateSetting('bodyFontSize', parseInt(e.target.value) || 12)}
                  className="w-20 px-3 py-2 bg-white border border-gray-300 rounded text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Line Height */}
            <div>
              <label className="block text-gray-700 text-xs font-medium mb-2">Line Height</label>
              <select
                value={settings.lineHeight}
                onChange={(e) => updateSetting('lineHeight', parseFloat(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="1">1</option>
                <option value="1.25">1.25</option>
                <option value="1.5">1.5</option>
                <option value="1.75">1.75</option>
                <option value="2">2</option>
              </select>
            </div>

            {/* Text Formatting - Always visible when text is selected */}
            {onFormat && (
              <div>
                <label className="block text-gray-700 text-xs font-medium mb-2">
                  Text Formatting {hasSelection ? '(Text Selected)' : '(Select text to format)'}
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.preventDefault();
                      onFormat && onFormat('bold');
                    }}
                    disabled={!hasSelection}
                    className={`px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                      hasSelection
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300' 
                        : 'bg-gray-50 text-gray-400 cursor-not-allowed border border-gray-200'
                    }`}
                    title="Bold"
                  >
                    B
                  </button>
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.preventDefault();
                      onFormat && onFormat('italic');
                    }}
                    disabled={!hasSelection}
                    className={`px-3 py-1.5 rounded text-xs italic transition-colors ${
                      hasSelection
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300' 
                        : 'bg-gray-50 text-gray-400 cursor-not-allowed border border-gray-200'
                    }`}
                    title="Italic"
                  >
                    I
                  </button>
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.preventDefault();
                      onFormat && onFormat('underline');
                    }}
                    disabled={!hasSelection}
                    className={`px-3 py-1.5 rounded text-xs underline transition-colors ${
                      hasSelection
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300' 
                        : 'bg-gray-50 text-gray-400 cursor-not-allowed border border-gray-200'
                    }`}
                    title="Underline"
                  >
                    U
                  </button>
                </div>
              </div>
            )}

            {/* Links */}
            <div>
              <label className="block text-gray-700 text-xs font-medium mb-2">Links</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.linkColor || '#000000'}
                  onChange={(e) => updateSetting('linkColor', e.target.value)}
                  className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                />
                <div className="flex gap-1">
                  <button
                    onClick={() => updateSetting('linkBold', !settings.linkBold)}
                    className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                      settings.linkBold 
                        ? 'bg-blue-500 text-white hover:bg-blue-600' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                    }`}
                  >
                    B
                  </button>
                  <button
                    onClick={() => updateSetting('linkItalic', !settings.linkItalic)}
                    className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                      settings.linkItalic 
                        ? 'bg-blue-500 text-white hover:bg-blue-600' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                    }`}
                  >
                    I
                  </button>
                  <button
                    onClick={() => updateSetting('linkUnderline', !settings.linkUnderline)}
                    className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                      settings.linkUnderline 
                        ? 'bg-blue-500 text-white hover:bg-blue-600' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                    }`}
                  >
                    U
                  </button>
                </div>
              </div>
            </div>

            {/* Heading 1 + Header component */}
            <div>
              <label className="block text-gray-700 text-xs font-medium mb-2">Heading 1 + Header component</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.headingColor || settings.bodyTextColor}
                  onChange={(e) => updateSetting('headingColor', e.target.value)}
                  className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                />
                <select
                  value={settings.headingFont || settings.bodyFont}
                  onChange={(e) => updateSetting('headingFont', e.target.value)}
                  className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="Arial">Arial</option>
                  <option value="Helvetica">Helvetica</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Times New Roman">Times New Roman</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DesignSettingsPanel;

