import React, { useState, useRef, useEffect } from 'react';
import {
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  ListBulletIcon,
  LinkIcon,
  PhotoIcon,
  VideoCameraIcon,
  CodeBracketIcon,
  EyeIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

const RichEmailEditor = ({ value, onChange, onPreview }) => {
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (editorRef.current && value) {
      editorRef.current.innerHTML = value;
    }
  }, []);

  const execCommand = (command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleContentChange();
  };

  const handleContentChange = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch('/api/communication/email/upload-image', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const data = await response.json();
      if (data.success) {
        // Use the image URL from API
        const imageUrl = data.image_url;
        const imgTag = `<div style="text-align: center; margin: 20px 0;"><img src="${imageUrl}" alt="Uploaded image" style="max-width: 100%; height: auto;" /></div>`;
        execCommand('insertHTML', imgTag);
        setShowImageUpload(false);
        setImageUrl('');
      } else {
        alert('Failed to upload image: ' + data.error);
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Error uploading image');
    }
  };

  const handleInsertLink = () => {
    if (linkUrl && linkText) {
      const linkTag = `<a href="${linkUrl}" target="_blank" style="color: #3b82f6; text-decoration: underline;">${linkText}</a>`;
      execCommand('insertHTML', linkTag);
      setShowLinkDialog(false);
      setLinkUrl('');
      setLinkText('');
    }
  };

  const handleInsertVideo = () => {
    if (videoUrl) {
      // Support YouTube, Vimeo, and direct video URLs
      let embedHtml = '';
      
      // YouTube
      if (videoUrl.includes('youtube.com/watch') || videoUrl.includes('youtu.be')) {
        const videoId = videoUrl.includes('youtu.be') 
          ? videoUrl.split('youtu.be/')[1].split('?')[0]
          : videoUrl.split('v=')[1].split('&')[0];
        embedHtml = `<div style="margin: 20px 0; text-align: center;">
          <iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="max-width: 100%; height: auto;"></iframe>
        </div>`;
      }
      // Vimeo
      else if (videoUrl.includes('vimeo.com')) {
        const videoId = videoUrl.split('vimeo.com/')[1].split('?')[0];
        embedHtml = `<div style="margin: 20px 0; text-align: center;">
          <iframe src="https://player.vimeo.com/video/${videoId}" width="560" height="315" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen style="max-width: 100%; height: auto;"></iframe>
        </div>`;
      }
      // Direct video URL
      else if (videoUrl.match(/\.(mp4|webm|ogg)$/i)) {
        embedHtml = `<div style="margin: 20px 0; text-align: center;">
          <video controls width="560" style="max-width: 100%; height: auto;">
            <source src="${videoUrl}" type="video/mp4">
            Your browser does not support the video tag.
          </video>
        </div>`;
      }
      // Generic video link
      else {
        embedHtml = `<div style="margin: 20px 0; text-align: center;">
          <a href="${videoUrl}" target="_blank" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px;">
            Watch Video
          </a>
        </div>`;
      }
      
      execCommand('insertHTML', embedHtml);
      setShowVideoDialog(false);
      setVideoUrl('');
    }
  };

  const insertBlock = (blockType) => {
    let html = '';
    switch (blockType) {
      case 'heading':
        html = '<h2 style="font-size: 24px; font-weight: bold; margin: 20px 0 10px 0; color: #1f2937;">Heading</h2>';
        break;
      case 'paragraph':
        html = '<p style="margin: 10px 0; line-height: 1.6; color: #374151;">Paragraph text</p>';
        break;
      case 'button':
        html = '<a href="#" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin: 10px 0;">Button Text</a>';
        break;
      case 'divider':
        html = '<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />';
        break;
      case 'two-column':
        html = `
          <table style="width: 100%; margin: 20px 0;">
            <tr>
              <td style="width: 50%; padding: 10px; vertical-align: top;">
                <p>Left column content</p>
              </td>
              <td style="width: 50%; padding: 10px; vertical-align: top;">
                <p>Right column content</p>
              </td>
            </tr>
          </table>
        `;
        break;
      default:
        return;
    }
    execCommand('insertHTML', html);
  };

  const getFontSize = () => {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const element = selection.getRangeAt(0).commonAncestorContainer.parentElement;
      return element?.style?.fontSize || '16px';
    }
    return '16px';
  };

  const setFontSize = (size) => {
    execCommand('fontSize', '7'); // This is a hack, we'll use CSS instead
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const element = range.commonAncestorContainer.parentElement;
      if (element) {
        element.style.fontSize = size;
      }
    }
    handleContentChange();
  };

  const setFontColor = (color) => {
    execCommand('foreColor', color);
  };

  const setBackgroundColor = (color) => {
    execCommand('backColor', color);
  };

  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-white/10 bg-white/5">
        {/* Text Formatting */}
        <div className="flex items-center gap-1 border-r border-white/10 pr-2">
          <button
            type="button"
            onClick={() => execCommand('bold')}
            className="p-2 hover:bg-white/10 rounded transition-colors"
            title="Bold"
          >
            <BoldIcon className="w-4 h-4 text-white" />
          </button>
          <button
            type="button"
            onClick={() => execCommand('italic')}
            className="p-2 hover:bg-white/10 rounded transition-colors"
            title="Italic"
          >
            <ItalicIcon className="w-4 h-4 text-white" />
          </button>
          <button
            type="button"
            onClick={() => execCommand('underline')}
            className="p-2 hover:bg-white/10 rounded transition-colors"
            title="Underline"
          >
            <UnderlineIcon className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Lists */}
        <div className="flex items-center gap-1 border-r border-white/10 pr-2">
          <button
            type="button"
            onClick={() => execCommand('insertUnorderedList')}
            className="p-2 hover:bg-white/10 rounded transition-colors"
            title="Bullet List"
          >
            <ListBulletIcon className="w-4 h-4 text-white" />
          </button>
          <button
            type="button"
            onClick={() => execCommand('insertOrderedList')}
            className="p-2 hover:bg-white/10 rounded transition-colors"
            title="Numbered List"
          >
            <span className="text-white text-sm font-bold">1.</span>
          </button>
        </div>

        {/* Font Size */}
        <div className="flex items-center gap-1 border-r border-white/10 pr-2">
          <select
            onChange={(e) => setFontSize(e.target.value)}
            className="px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            defaultValue="16px"
          >
            <option value="12px" className="bg-slate-800">12px</option>
            <option value="14px" className="bg-slate-800">14px</option>
            <option value="16px" className="bg-slate-800">16px</option>
            <option value="18px" className="bg-slate-800">18px</option>
            <option value="20px" className="bg-slate-800">20px</option>
            <option value="24px" className="bg-slate-800">24px</option>
            <option value="28px" className="bg-slate-800">28px</option>
            <option value="32px" className="bg-slate-800">32px</option>
          </select>
        </div>

        {/* Colors */}
        <div className="flex items-center gap-1 border-r border-white/10 pr-2">
          <input
            type="color"
            onChange={(e) => setFontColor(e.target.value)}
            className="w-8 h-8 rounded border border-white/20 cursor-pointer"
            title="Text Color"
          />
          <input
            type="color"
            onChange={(e) => setBackgroundColor(e.target.value)}
            className="w-8 h-8 rounded border border-white/20 cursor-pointer"
            title="Background Color"
          />
        </div>

        {/* Alignment */}
        <div className="flex items-center gap-1 border-r border-white/10 pr-2">
          <button
            type="button"
            onClick={() => execCommand('justifyLeft')}
            className="p-2 hover:bg-white/10 rounded transition-colors text-white text-sm font-bold"
            title="Align Left"
          >
            ⬅
          </button>
          <button
            type="button"
            onClick={() => execCommand('justifyCenter')}
            className="p-2 hover:bg-white/10 rounded transition-colors text-white text-sm font-bold"
            title="Align Center"
          >
            ⬌
          </button>
          <button
            type="button"
            onClick={() => execCommand('justifyRight')}
            className="p-2 hover:bg-white/10 rounded transition-colors text-white text-sm font-bold"
            title="Align Right"
          >
            ➡
          </button>
        </div>

        {/* Insert Elements */}
        <div className="flex items-center gap-1 border-r border-white/10 pr-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 hover:bg-white/10 rounded transition-colors"
            title="Insert Image"
          >
            <PhotoIcon className="w-4 h-4 text-white" />
          </button>
          <button
            type="button"
            onClick={() => setShowLinkDialog(true)}
            className="p-2 hover:bg-white/10 rounded transition-colors"
            title="Insert Link"
          >
            <LinkIcon className="w-4 h-4 text-white" />
          </button>
          <button
            type="button"
            onClick={() => setShowVideoDialog(true)}
            className="p-2 hover:bg-white/10 rounded transition-colors"
            title="Insert Video"
          >
            <VideoCameraIcon className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Blocks */}
        <div className="flex items-center gap-1">
          <select
            onChange={(e) => {
              if (e.target.value) {
                insertBlock(e.target.value);
                e.target.value = '';
              }
            }}
            className="px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            defaultValue=""
          >
            <option value="" className="bg-slate-800">Insert Block...</option>
            <option value="heading" className="bg-slate-800">Heading</option>
            <option value="paragraph" className="bg-slate-800">Paragraph</option>
            <option value="button" className="bg-slate-800">Button</option>
            <option value="divider" className="bg-slate-800">Divider</option>
            <option value="two-column" className="bg-slate-800">Two Columns</option>
          </select>
        </div>

        {/* Personalization */}
        <div className="flex items-center gap-1 ml-auto border-l border-white/10 pl-2">
          <select
            onChange={(e) => {
              if (e.target.value) {
                execCommand('insertHTML', e.target.value);
                e.target.value = '';
              }
            }}
            className="px-2 py-1 bg-blue-500/20 border border-blue-500/40 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            defaultValue=""
          >
            <option value="" className="bg-slate-800">Personalization...</option>
            <option value="[Firstname]" className="bg-slate-800">[Firstname]</option>
            <option value="[Lastname]" className="bg-slate-800">[Lastname]</option>
            <option value="[Fullname]" className="bg-slate-800">[Fullname]</option>
            <option value="[Campus]" className="bg-slate-800">[Campus]</option>
            <option value="[Department]" className="bg-slate-800">[Department]</option>
            <option value="[Email]" className="bg-slate-800">[Email]</option>
            <option value="[Mobile]" className="bg-slate-800">[Mobile]</option>
          </select>
        </div>
      </div>

      {/* Editor */}
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable
          onInput={handleContentChange}
          className="min-h-[400px] p-6 text-white focus:outline-none"
          style={{
            fontFamily: 'Arial, sans-serif',
            fontSize: '16px',
            lineHeight: '1.6'
          }}
          dangerouslySetInnerHTML={{ __html: value || '<p>Start typing your email content here...</p>' }}
        />
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />

      {/* Link Dialog */}
      {showLinkDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-xl p-6 border border-white/10 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Insert Link</h3>
              <button
                onClick={() => setShowLinkDialog(false)}
                className="p-2 hover:bg-white/10 rounded transition-colors"
              >
                <XMarkIcon className="w-5 h-5 text-white" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-white/80 text-sm font-semibold mb-2">Link Text</label>
                <input
                  type="text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Click here"
                />
              </div>
              <div>
                <label className="block text-white/80 text-sm font-semibold mb-2">URL</label>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://example.com"
                />
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowLinkDialog(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInsertLink}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                >
                  Insert
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Video Dialog */}
      {showVideoDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-xl p-6 border border-white/10 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Insert Video</h3>
              <button
                onClick={() => setShowVideoDialog(false)}
                className="p-2 hover:bg-white/10 rounded transition-colors"
              >
                <XMarkIcon className="w-5 h-5 text-white" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-white/80 text-sm font-semibold mb-2">Video URL</label>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="YouTube, Vimeo, or direct video URL"
                />
                <p className="text-white/50 text-xs mt-1">
                  Supports YouTube, Vimeo, or direct video links (.mp4, .webm, .ogg)
                </p>
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowVideoDialog(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInsertVideo}
                  disabled={!videoUrl}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  Insert
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RichEmailEditor;

