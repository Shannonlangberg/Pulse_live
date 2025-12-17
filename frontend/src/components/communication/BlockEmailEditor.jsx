import React, { useState, useRef, useEffect } from 'react';
import {
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  ListBulletIcon,
  LinkIcon,
  PhotoIcon,
  VideoCameraIcon,
  XMarkIcon,
  Bars3Icon,
  TrashIcon,
  PlusIcon
} from '@heroicons/react/24/outline';

const BlockEmailEditor = ({ value, onChange }) => {
  const [blocks, setBlocks] = useState([]);
  const [draggedBlock, setDraggedBlock] = useState(null);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imageType, setImageType] = useState('regular'); // 'regular' or 'header'
  const [videoUrl, setVideoUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const fileInputRef = useRef(null);
  const headerImageInputRef = useRef(null);

  useEffect(() => {
    // Parse existing HTML into blocks
    if (value) {
      parseHTMLToBlocks(value);
    } else {
      setBlocks([{ id: Date.now(), type: 'text', content: '<p>Start typing your email content here...</p>' }]);
    }
  }, []);

  useEffect(() => {
    // Convert blocks back to HTML whenever blocks change
    const html = blocksToHTML(blocks);
    onChange(html);
  }, [blocks]);

  const parseHTMLToBlocks = (html) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const body = doc.body;
    const blockArray = [];
    let blockId = Date.now();

    // Check for header image first
    const headerImg = body.querySelector('img[data-type="header"]');
    if (headerImg) {
      blockArray.push({
        id: blockId++,
        type: 'header-image',
        content: headerImg.outerHTML
      });
    }

    // Parse other elements
    Array.from(body.children).forEach(child => {
      if (child.tagName === 'IMG' && !child.hasAttribute('data-type')) {
        blockArray.push({
          id: blockId++,
          type: 'image',
          content: child.outerHTML
        });
      } else if (child.tagName === 'IFRAME' || child.querySelector('iframe')) {
        blockArray.push({
          id: blockId++,
          type: 'video',
          content: child.outerHTML
        });
      } else if (child.innerHTML.trim()) {
        blockArray.push({
          id: blockId++,
          type: 'text',
          content: child.outerHTML
        });
      }
    });

    if (blockArray.length === 0) {
      blockArray.push({
        id: blockId++,
        type: 'text',
        content: '<p>Start typing your email content here...</p>'
      });
    }

    setBlocks(blockArray);
  };

  const blocksToHTML = (blocksArray) => {
    return blocksArray.map(block => block.content).join('');
  };

  const handleDragStart = (e, blockId) => {
    setDraggedBlock(blockId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', '');
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetBlockId) => {
    e.preventDefault();
    if (!draggedBlock || draggedBlock === targetBlockId) return;

    const draggedIndex = blocks.findIndex(b => b.id === draggedBlock);
    const targetIndex = blocks.findIndex(b => b.id === targetBlockId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newBlocks = [...blocks];
    const [removed] = newBlocks.splice(draggedIndex, 1);
    newBlocks.splice(targetIndex, 0, removed);

    setBlocks(newBlocks);
    setDraggedBlock(null);
  };

  const handleDragEnd = () => {
    setDraggedBlock(null);
  };

  const addBlock = (type) => {
    let content = '';
    switch (type) {
      case 'text':
        content = '<p>New paragraph</p>';
        break;
      case 'heading':
        content = '<h2 style="font-size: 24px; font-weight: bold; margin: 20px 0 10px 0; color: #1f2937;">Heading</h2>';
        break;
      case 'button':
        content = '<a href="#" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin: 10px 0;">Button Text</a>';
        break;
      case 'divider':
        content = '<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />';
        break;
      case 'two-column':
        content = `
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

    const newBlock = {
      id: Date.now(),
      type: type,
      content: content
    };

    setBlocks([...blocks, newBlock]);
  };

  const updateBlockContent = (blockId, newContent) => {
    setBlocks(blocks.map(block =>
      block.id === blockId ? { ...block, content: newContent } : block
    ));
  };

  const deleteBlock = (blockId) => {
    setBlocks(blocks.filter(block => block.id !== blockId));
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
        const imgStyle = imageType === 'header' 
          ? 'width: 100%; max-width: 600px; height: auto; display: block; margin: 0 auto;'
          : 'max-width: 100%; height: auto;';
        
        const imgTag = imageType === 'header'
          ? `<img src="${imageUrl}" alt="Header image" style="${imgStyle}" data-type="header" />`
          : `<div style="text-align: center; margin: 20px 0;"><img src="${imageUrl}" alt="Image" style="${imgStyle}" /></div>`;
        
        const newBlock = {
          id: Date.now(),
          type: imageType === 'header' ? 'header-image' : 'image',
          content: imgTag
        };

        if (imageType === 'header') {
          // Remove existing header image and add new one at the top
          const filteredBlocks = blocks.filter(b => b.type !== 'header-image');
          setBlocks([newBlock, ...filteredBlocks]);
        } else {
          setBlocks([...blocks, newBlock]);
        }

        setShowImageDialog(false);
        setImageUrl('');
        setImageType('regular');
      } else {
        alert('Failed to upload image: ' + data.error);
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Error uploading image');
    }
  };

  const handleInsertVideo = () => {
    if (videoUrl) {
      let embedHtml = '';
      
      if (videoUrl.includes('youtube.com/watch') || videoUrl.includes('youtu.be')) {
        const videoId = videoUrl.includes('youtu.be') 
          ? videoUrl.split('youtu.be/')[1].split('?')[0]
          : videoUrl.split('v=')[1].split('&')[0];
        embedHtml = `<div style="margin: 20px 0; text-align: center;">
          <iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="max-width: 100%; height: auto;"></iframe>
        </div>`;
      } else if (videoUrl.includes('vimeo.com')) {
        const videoId = videoUrl.split('vimeo.com/')[1].split('?')[0];
        embedHtml = `<div style="margin: 20px 0; text-align: center;">
          <iframe src="https://player.vimeo.com/video/${videoId}" width="560" height="315" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen style="max-width: 100%; height: auto;"></iframe>
        </div>`;
      } else if (videoUrl.match(/\.(mp4|webm|ogg)$/i)) {
        embedHtml = `<div style="margin: 20px 0; text-align: center;">
          <video controls width="560" style="max-width: 100%; height: auto;">
            <source src="${videoUrl}" type="video/mp4">
            Your browser does not support the video tag.
          </video>
        </div>`;
      } else {
        embedHtml = `<div style="margin: 20px 0; text-align: center;">
          <a href="${videoUrl}" target="_blank" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px;">
            Watch Video
          </a>
        </div>`;
      }
      
      const newBlock = {
        id: Date.now(),
        type: 'video',
        content: embedHtml
      };

      setBlocks([...blocks, newBlock]);
      setShowVideoDialog(false);
      setVideoUrl('');
    }
  };

  const handleInsertLink = () => {
    if (linkUrl && linkText) {
      const linkTag = `<a href="${linkUrl}" target="_blank" style="color: #3b82f6; text-decoration: underline;">${linkText}</a>`;
      
      // Insert into currently focused block or create new text block
      const focusedBlock = blocks.find(b => b.type === 'text');
      if (focusedBlock) {
        updateBlockContent(focusedBlock.id, focusedBlock.content + ' ' + linkTag);
      } else {
        const newBlock = {
          id: Date.now(),
          type: 'text',
          content: `<p>${linkTag}</p>`
        };
        setBlocks([...blocks, newBlock]);
      }

      setShowLinkDialog(false);
      setLinkUrl('');
      setLinkText('');
    }
  };

  const execCommand = (command, value = null) => {
    document.execCommand(command, false, value);
  };

  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-white/10 bg-white/5">
        {/* Add Blocks */}
        <div className="flex items-center gap-1 border-r border-white/10 pr-2">
          <select
            onChange={(e) => {
              if (e.target.value) {
                addBlock(e.target.value);
                e.target.value = '';
              }
            }}
            className="px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            defaultValue=""
          >
            <option value="" className="bg-slate-800">Add Block...</option>
            <option value="heading" className="bg-slate-800">Heading</option>
            <option value="text" className="bg-slate-800">Text</option>
            <option value="button" className="bg-slate-800">Button</option>
            <option value="divider" className="bg-slate-800">Divider</option>
            <option value="two-column" className="bg-slate-800">Two Columns</option>
          </select>
        </div>

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

        {/* Insert Elements */}
        <div className="flex items-center gap-1 border-r border-white/10 pr-2">
          <button
            type="button"
            onClick={() => {
              setImageType('header');
              headerImageInputRef.current?.click();
            }}
            className="p-2 hover:bg-white/10 rounded transition-colors"
            title="Header Image"
          >
            <PhotoIcon className="w-4 h-4 text-blue-400" />
          </button>
          <button
            type="button"
            onClick={() => {
              setImageType('regular');
              fileInputRef.current?.click();
            }}
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

        {/* Personalization */}
        <div className="flex items-center gap-1 ml-auto">
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
          </select>
        </div>
      </div>

      {/* Blocks Editor */}
      <div className="p-4 space-y-4 min-h-[400px]">
        {blocks.map((block, index) => (
          <div
            key={block.id}
            draggable
            onDragStart={(e) => handleDragStart(e, block.id)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, block.id)}
            onDragEnd={handleDragEnd}
            className={`group relative bg-white/5 rounded-lg border-2 border-transparent hover:border-blue-500/50 transition-all ${
              draggedBlock === block.id ? 'opacity-50' : ''
            }`}
          >
            {/* Drag Handle */}
            <div className="absolute -left-8 top-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-move">
              <Bars3Icon className="w-5 h-5 text-white/60" />
            </div>

            {/* Block Content */}
            <div className="p-4">
              {block.type === 'text' ? (
                <div
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(e) => {
                    // Fix backwards text issue - get selection and maintain cursor position
                    const selection = window.getSelection();
                    const range = selection.getRangeAt(0);
                    const cursorPos = range.startOffset;
                    
                    updateBlockContent(block.id, e.target.innerHTML);
                    
                    // Restore cursor position after update
                    setTimeout(() => {
                      const newRange = document.createRange();
                      const textNode = e.target.childNodes[0] || e.target;
                      const maxOffset = textNode.textContent ? textNode.textContent.length : 0;
                      const safeOffset = Math.min(cursorPos, maxOffset);
                      newRange.setStart(textNode, safeOffset);
                      newRange.setEnd(textNode, safeOffset);
                      selection.removeAllRanges();
                      selection.addRange(newRange);
                    }, 0);
                  }}
                  onBlur={(e) => updateBlockContent(block.id, e.target.innerHTML)}
                  className="min-h-[50px] text-white focus:outline-none"
                  style={{ direction: 'ltr', unicodeBidi: 'embed' }}
                  dangerouslySetInnerHTML={{ __html: block.content }}
                />
              ) : (
                <div dangerouslySetInnerHTML={{ __html: block.content }} />
              )}
            </div>

            {/* Delete Button */}
            <button
              onClick={() => deleteBlock(block.id)}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-red-500/20 hover:bg-red-500/40 rounded"
            >
              <TrashIcon className="w-4 h-4 text-red-400" />
            </button>
          </div>
        ))}

        {blocks.length === 0 && (
          <div className="text-center py-12 text-white/60">
            Click "Add Block" to start building your email
          </div>
        )}
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />
      <input
        ref={headerImageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />

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
    </div>
  );
};

export default BlockEmailEditor;

