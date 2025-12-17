import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  PhotoIcon,
  VideoCameraIcon,
  DocumentTextIcon,
  Squares2X2Icon,
  RectangleStackIcon,
  Bars3Icon,
  TrashIcon,
  PlusIcon,
  MinusIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

const DEFAULT_BLOCK_HTML = '<p style="margin: 0;">Start typing your email content here...</p>';

const DEFAULT_SETTINGS = {
  emailWidth: 600,
  evenColumns: true,
  fullWidthMobile: false,
  gridWidth: 25,
  useGrid: false,
  borderColor: '#1f2937',
  borderWidth: 0,
  backgroundColor: '#ffffff',
  fullHeightBackground: false,
  backgroundImage: null,
  bodyTextColor: '#1f2937',
  bodyFont: 'Inter, system-ui, sans-serif',
  bodyFontSize: 14,
  lineHeight: 1.6,
  linkColor: '#3b82f6',
  linkBold: false,
  linkItalic: false,
  linkUnderline: true
};

const blockTemplates = {
  text: DEFAULT_BLOCK_HTML,
  heading: '<h2 style="margin: 0; font-size: 28px; font-weight: 700;">Add a headline</h2>',
  divider: '<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />',
  spacer: '<div style="height: 32px;"></div>',
  button:
    '<div style="text-align:center; margin: 24px 0;"><a href="#" style="display:inline-block;padding:14px 28px;border-radius:999px;background:linear-gradient(90deg,#3b82f6,#06b6d4);color:white;font-weight:600;text-decoration:none;">Call to action</a></div>',
  footer:
    '<div style="padding: 24px; text-align: center; color: #6b7280; font-size: 12px;">Add your address, socials or unsubscribe link here.</div>',
  'two-column':
    '<table style="width:100%; border-collapse:collapse; margin:24px 0;"><tr><td style="width:50%; padding:12px; vertical-align:top;"><p>Left column content</p></td><td style="width:50%; padding:12px; vertical-align:top;"><p>Right column content</p></td></tr></table>',
  hero:
    '<div style="padding: 48px 32px; text-align:center; background: linear-gradient(135deg,#2563eb,#7c3aed); border-radius: 24px; color: white;"><h1 style="margin: 0; font-size: 36px;">Hero headline</h1><p style="margin-top: 12px; opacity: 0.9;">Supporting copy for the hero block.</p></div>'
};

const blockLibrary = [
  {
    type: 'heading',
    label: 'Heading',
    description: 'Hero or section titles',
    icon: DocumentTextIcon
  },
  {
    type: 'text',
    label: 'Body copy',
    description: 'Paragraph content',
    icon: DocumentTextIcon
  },
  {
    type: 'button',
    label: 'Call to action',
    description: 'Styled CTA buttons',
    icon: Squares2X2Icon
  },
  {
    type: 'two-column',
    label: 'Two column',
    description: 'Side-by-side layout',
    icon: RectangleStackIcon
  },
  {
    type: 'divider',
    label: 'Divider',
    description: 'Visual separators',
    icon: MinusIcon
  },
  {
    type: 'spacer',
    label: 'Spacer',
    description: 'Breathing room',
    icon: PlusIcon
  },
  {
    type: 'footer',
    label: 'Footer',
    description: 'Contact + footer area',
    icon: Bars3Icon
  },
  {
    type: 'hero',
    label: 'Hero panel',
    description: 'Gradient hero section',
    icon: RectangleStackIcon
  }
];

const createBlockId = () => `${Date.now()}-${Math.round(Math.random() * 100000)}`;

const getDefaultBlocks = () => [{ id: createBlockId(), type: 'text', content: DEFAULT_BLOCK_HTML }];

const isBrowser = () => typeof window !== 'undefined';

const Vision6EmailEditor = ({
  value,
  onChange,
  designSettings,
  onSelectionChange,
  onFormatHandlerChange
}) => {
  const [blocks, setBlocks] = useState(getDefaultBlocks);
  const [draggedBlock, setDraggedBlock] = useState(null);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [imageType, setImageType] = useState('regular');
  const fileInputRef = useRef(null);
  const headerImageInputRef = useRef(null);
  const textBlockRefs = useRef({});
  const selectionStateRef = useRef({ blockId: null, range: null });
  const lastSyncedHtmlRef = useRef(value || '');

  const settings = useMemo(() => ({ ...DEFAULT_SETTINGS, ...designSettings }), [designSettings]);

  const buildBlocksFromHTML = useCallback((html) => {
    if (!html || typeof html !== 'string' || !isBrowser()) {
      return getDefaultBlocks();
    }

    try {
      const parser = new window.DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const body = doc.body;

      if (!body) {
        return getDefaultBlocks();
      }

      const parsedBlocks = [];
      let tempId = Date.now();

      const headerImg = body.querySelector('img[data-type="header"]');
      if (headerImg) {
        parsedBlocks.push({
          id: `${tempId++}`,
          type: 'header-image',
          content: headerImg.outerHTML
        });
      }

      Array.from(body.children).forEach((child) => {
        if (child === headerImg) {
          return;
        }

        if (child.tagName === 'IMG' && !child.hasAttribute('data-type')) {
          parsedBlocks.push({ id: `${tempId++}`, type: 'image', content: child.outerHTML });
        } else if (child.tagName === 'IFRAME' || child.querySelector('iframe')) {
          parsedBlocks.push({ id: `${tempId++}`, type: 'video', content: child.outerHTML });
        } else if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(child.tagName)) {
          parsedBlocks.push({ id: `${tempId++}`, type: 'heading', content: child.outerHTML });
        } else if (child.innerHTML.trim()) {
          parsedBlocks.push({ id: `${tempId++}`, type: 'text', content: child.outerHTML });
        }
      });

      return parsedBlocks.length ? parsedBlocks : getDefaultBlocks();
    } catch (error) {
      console.error('Error parsing HTML to blocks:', error);
      return getDefaultBlocks();
    }
  }, []);

  const blocksToHTML = useCallback(
    (blocksArray) => {
      const emailStyle = `
        width: ${settings.emailWidth}px;
        max-width: 100%;
        margin: 0 auto;
        background-color: ${settings.backgroundColor};
        border: ${settings.borderWidth}px solid ${settings.borderColor};
        font-family: ${settings.bodyFont};
        font-size: ${settings.bodyFontSize}px;
        line-height: ${settings.lineHeight};
        color: ${settings.bodyTextColor};
      `;

      const content = blocksArray.map((block) => block.content).join('\n');

      return `
        <div style="${emailStyle}">
          ${
            settings.backgroundImage
              ? `<div style="background-image:url(${settings.backgroundImage});background-size:cover;background-position:center;min-height:100%;">${content}</div>`
              : content
          }
        </div>
      `;
    },
    [settings]
  );

  useEffect(() => {
    if (value == null) {
      return;
    }

    if (value === lastSyncedHtmlRef.current) {
      return;
    }

    setBlocks(buildBlocksFromHTML(value));
  }, [value, buildBlocksFromHTML]);

  useEffect(() => {
    const html = blocksToHTML(blocks);
    lastSyncedHtmlRef.current = html;
    onChange(html);
  }, [blocks, blocksToHTML, onChange]);

  const updateBlockContent = useCallback((blockId, newContent) => {
    setBlocks((prev) =>
      prev.map((block) => (block.id === blockId ? { ...block, content: newContent } : block))
    );
  }, []);

  const persistSelectionForBlock = useCallback(
    (blockId) => {
      if (!isBrowser()) return;
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      const element = textBlockRefs.current[blockId];
      if (!element) return;
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      if (element !== container && !element.contains(container)) return;

      selectionStateRef.current = { blockId, range: range.cloneRange() };
      const hasText = !selection.isCollapsed && range.toString().trim().length > 0;
      onSelectionChange?.(hasText);
    },
    [onSelectionChange]
  );

  const clearSelectionState = useCallback(() => {
    selectionStateRef.current = { blockId: null, range: null };
    onSelectionChange?.(false);
  }, [onSelectionChange]);

  const handleDocumentSelectionChange = useCallback(() => {
    if (!isBrowser()) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      clearSelectionState();
      return;
    }

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;

    const matchingEntry = Object.entries(textBlockRefs.current).find(([id, node]) => {
      if (!node) return false;
      return node === container || node.contains(container);
    });

    if (!matchingEntry) {
      clearSelectionState();
      return;
    }

    const blockId = matchingEntry[0];
    selectionStateRef.current = { blockId, range: range.cloneRange() };
    const hasText = !selection.isCollapsed && range.toString().trim().length > 0;
    onSelectionChange?.(hasText);
  }, [clearSelectionState, onSelectionChange]);

  useEffect(() => {
    if (!isBrowser()) return;
    document.addEventListener('selectionchange', handleDocumentSelectionChange);
    return () => document.removeEventListener('selectionchange', handleDocumentSelectionChange);
  }, [handleDocumentSelectionChange]);

  const applyExternalFormat = useCallback(
    (command, value = null) => {
      if (!isBrowser()) return;

      const { blockId, range } = selectionStateRef.current;
      if (!blockId || !range || range.collapsed) {
        return;
      }

      const element = textBlockRefs.current[blockId];
      if (!element) {
        return;
      }

      const selection = window.getSelection();
      if (!selection) return;

      element.focus({ preventScroll: true });
      selection.removeAllRanges();
      selection.addRange(range);

      if (typeof document.execCommand === 'function') {
        document.execCommand(command, false, value);
      }

      updateBlockContent(blockId, element.innerHTML);

      if (selection.rangeCount > 0) {
        const nextRange = selection.getRangeAt(0).cloneRange();
        selectionStateRef.current = { blockId, range: nextRange };
        const hasText = !selection.isCollapsed && nextRange.toString().trim().length > 0;
        onSelectionChange?.(hasText);
      }
    },
    [onSelectionChange, updateBlockContent]
  );

  useEffect(() => {
    if (typeof onFormatHandlerChange === 'function') {
      onFormatHandlerChange(applyExternalFormat);
    }
  }, [applyExternalFormat, onFormatHandlerChange]);

  const handleDragStart = useCallback((e, blockId) => {
    setDraggedBlock(blockId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (e, targetBlockId) => {
      e.preventDefault();
      setBlocks((prev) => {
        if (!draggedBlock || draggedBlock === targetBlockId) return prev;
        const draggedIndex = prev.findIndex((block) => block.id === draggedBlock);
        const targetIndex = prev.findIndex((block) => block.id === targetBlockId);
        if (draggedIndex === -1 || targetIndex === -1) return prev;
        const updated = [...prev];
        const [removed] = updated.splice(draggedIndex, 1);
        updated.splice(targetIndex, 0, removed);
        return updated;
      });
      setDraggedBlock(null);
    },
    [draggedBlock]
  );

  const handleDragEnd = useCallback(() => setDraggedBlock(null), []);

  const createBlock = useCallback((type) => ({
    id: createBlockId(),
    type,
    content: blockTemplates[type] || blockTemplates.text
  }), []);

  const addBlock = useCallback(
    (type) => {
      if (type === 'image') {
        setImageType('regular');
        fileInputRef.current?.click();
        return;
      }

      if (type === 'header-image') {
        setImageType('header');
        headerImageInputRef.current?.click();
        return;
      }

      if (type === 'video') {
        setShowVideoDialog(true);
        return;
      }

      const newBlock = createBlock(type);
      setBlocks((prev) => [...prev, newBlock]);
      setSelectedBlock(newBlock.id);
    },
    [createBlock]
  );

  const deleteBlock = useCallback(
    (blockId) => {
      setBlocks((prev) => prev.filter((block) => block.id !== blockId));
      if (selectionStateRef.current.blockId === blockId) {
        clearSelectionState();
      }
    },
    [clearSelectionState]
  );

  const handleImageUpload = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
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
        if (!data.success) {
          throw new Error(data.error || 'Failed to upload image');
        }

        const imageUrl = data.image_url;
        const imageStyles =
          imageType === 'header'
            ? `width: 100%; max-width: ${settings.emailWidth}px; height: auto; display: block; margin: 0 auto; border-radius: 28px;`
            : 'max-width: 100%; height: auto; border-radius: 18px;';

        const block =
          imageType === 'header'
            ? {
                id: createBlockId(),
                type: 'header-image',
                content: `<img src="${imageUrl}" alt="Header" data-type="header" style="${imageStyles}" />`
              }
            : {
                id: createBlockId(),
                type: 'image',
                content: `<div style="text-align:center; margin: 32px 0;"><img src="${imageUrl}" alt="Uploaded" style="${imageStyles}" /></div>`
              };

        setBlocks((prev) => {
          if (imageType === 'header') {
            const withoutHeader = prev.filter((item) => item.type !== 'header-image');
            return [block, ...withoutHeader];
          }
          return [...prev, block];
        });
      } catch (error) {
        console.error('Image upload failed', error);
        alert('Unable to upload image. Please try again.');
      } finally {
        setImageType('regular');
        event.target.value = '';
      }
    },
    [imageType, settings.emailWidth]
  );

  const handleInsertVideo = useCallback(() => {
    if (!videoUrl) return;
    const url = videoUrl.trim();
    let embedHtml = '';

    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = url.includes('youtu.be')
        ? url.split('youtu.be/')[1].split('?')[0]
        : url.split('v=')[1]?.split('&')[0];
      embedHtml = `<div style="margin: 32px 0; text-align:center;"><iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen style="border-radius: 20px; width:100%; max-width:560px;"></iframe></div>`;
    } else if (url.includes('vimeo.com')) {
      const videoId = url.split('vimeo.com/')[1];
      embedHtml = `<div style="margin: 32px 0; text-align:center;"><iframe src="https://player.vimeo.com/video/${videoId}" width="560" height="315" frameborder="0" allowfullscreen style="border-radius: 20px; width:100%; max-width:560px;"></iframe></div>`;
    } else {
      embedHtml = `<div style="margin: 32px 0; text-align:center;"><video controls style="width:100%; max-width:560px; border-radius: 20px;"><source src="${url}" /></video></div>`;
    }

    const block = {
      id: createBlockId(),
      type: 'video',
      content: embedHtml
    };

    setBlocks((prev) => [...prev, block]);
    setVideoUrl('');
    setShowVideoDialog(false);
  }, [videoUrl]);

  const renderBlockBadge = (type) => {
    const label = type.replace('-', ' ');
    return (
      <span className="absolute -top-3 left-8 bg-slate-900 text-white/90 text-[11px] tracking-wide uppercase px-3 py-1 rounded-full border border-white/10">
        {label}
      </span>
    );
  };

  return (
    <div className="flex h-full bg-[#0b1120] text-white">
      <aside className="w-72 border-r border-white/10 p-5 bg-white/5 backdrop-blur-xl overflow-y-auto">
        <div className="mb-4">
          <p className="text-xs uppercase text-white/60 tracking-[0.3em]">Content blocks</p>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {blockLibrary.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.type}
                onClick={() => addBlock(item.type)}
                className="w-full text-left rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all duration-200 p-4 flex items-start gap-3 hover:translate-x-1"
              >
                <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 text-white">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-white">{item.label}</p>
                  <p className="text-xs text-white/60">{item.description}</p>
                </div>
              </button>
            );
          })}
          <button
            onClick={() => addBlock('image')}
            className="w-full text-left rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all duration-200 p-4 flex items-start gap-3 hover:translate-x-1"
          >
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 text-white">
              <PhotoIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-sm text-white">Image upload</p>
              <p className="text-xs text-white/60">Drop in brand photography</p>
            </div>
          </button>
          <button
            onClick={() => addBlock('video')}
            className="w-full text-left rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all duration-200 p-4 flex items-start gap-3 hover:translate-x-1"
          >
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-white">
              <VideoCameraIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-sm text-white">Video embed</p>
              <p className="text-xs text-white/60">YouTube, Vimeo or direct links</p>
            </div>
          </button>
        </div>
      </aside>

      <section className="flex-1 flex flex-col bg-gradient-to-b from-[#111c2f] to-[#0b1120]">
        <header className="flex items-center justify-between px-8 py-4 border-b border-white/5 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/60">Canvas</p>
            <h3 className="text-lg font-semibold text-white">Vision6 email builder</h3>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => addBlock('header-image')}
              className="px-4 py-2 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 text-sm font-semibold shadow-lg shadow-blue-500/30 hover:scale-[1.01] transition"
            >
              Add header image
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-8">
          <div className="max-w-5xl mx-auto">
            <div className="relative">
              <div className="absolute inset-0 blur-3xl bg-gradient-to-tr from-blue-500/20 via-cyan-500/10 to-purple-500/10 pointer-events-none" />
              <div className="relative rounded-[32px] bg-white shadow-[0_40px_120px_rgba(15,23,42,0.35)] border border-white/40 overflow-hidden">
                <div
                  style={{
                    width: `${settings.emailWidth}px`,
                    maxWidth: '100%',
                    margin: '0 auto',
                    padding: '48px 40px'
                  }}
                >
                  {blocks.map((block) => (
                    <div
                      key={block.id}
                      onClick={() => setSelectedBlock(block.id)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, block.id)}
                      className={`group relative mb-6 rounded-3xl border transition-all ${
                        selectedBlock === block.id ? 'border-cyan-400 shadow-lg shadow-cyan-500/20 bg-white' : 'border-slate-200 bg-white'
                      } ${draggedBlock === block.id ? 'opacity-60' : ''}`}
                    >
                      {renderBlockBadge(block.type)}
                      <div className="absolute left-4 top-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div
                          draggable
                          onDragStart={(e) => {
                            e.stopPropagation();
                            handleDragStart(e, block.id);
                          }}
                          onDragEnd={handleDragEnd}
                          className="inline-flex items-center justify-center rounded-full bg-slate-900 text-white w-8 h-8 shadow-lg cursor-grab active:cursor-grabbing"
                        >
                          <Bars3Icon className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="p-8">
                        {['text', 'heading'].includes(block.type) ? (
                          <div
                            ref={(el) => {
                              if (el) {
                                textBlockRefs.current[block.id] = el;
                              } else {
                                delete textBlockRefs.current[block.id];
                              }
                            }}
                            contentEditable
                            suppressContentEditableWarning
                            dir="ltr"
                            spellCheck={false}
                            onInput={(e) => {
                              updateBlockContent(block.id, e.currentTarget.innerHTML);
                              persistSelectionForBlock(block.id);
                            }}
                            onKeyUp={() => persistSelectionForBlock(block.id)}
                            onMouseUp={() => persistSelectionForBlock(block.id)}
                            onSelect={() => persistSelectionForBlock(block.id)}
                            className="min-h-[48px] focus:outline-none rounded-2xl px-4 py-3 hover:bg-slate-100/80 focus:bg-blue-50 transition-colors text-slate-900"
                            style={{
                              fontFamily: settings.bodyFont,
                              fontSize: block.type === 'heading' ? '28px' : `${settings.bodyFontSize}px`,
                              lineHeight: settings.lineHeight,
                              fontWeight: block.type === 'heading' ? 700 : 400,
                              color: settings.bodyTextColor
                            }}
                            dangerouslySetInnerHTML={{ __html: block.content }}
                          />
                        ) : (
                          <div
                            className="prose prose-slate max-w-none"
                            dangerouslySetInnerHTML={{ __html: block.content }}
                          />
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteBlock(block.id);
                        }}
                        className="absolute top-4 right-4 p-2 rounded-full bg-red-500 text-white shadow-sm hover:scale-105 transition"
                        title="Delete block"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {blocks.length === 0 && (
                    <div className="text-center py-24 text-slate-400">
                      <PlusIcon className="w-12 h-12 mx-auto mb-4" />
                      <p className="text-lg font-semibold text-slate-500">Drop blocks from the left</p>
                      <p className="text-sm text-slate-400">Build your layout by combining typography, media and dividers.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
      <input
        ref={headerImageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />

      {showVideoDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xl p-4">
          <div className="bg-[#111c2f] border border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Embed video</h3>
              <button
                onClick={() => setShowVideoDialog(false)}
                className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs uppercase tracking-[0.3em] text-white/60">Video URL</label>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="YouTube, Vimeo or direct link"
                  className="mt-2 w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowVideoDialog(false)}
                  className="px-4 py-2 rounded-full border border-white/20 text-white/80"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInsertVideo}
                  disabled={!videoUrl}
                  className="px-4 py-2 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold disabled:opacity-50"
                >
                  Insert video
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vision6EmailEditor;
