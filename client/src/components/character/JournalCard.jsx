// client/src/components/character/JournalCard.jsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

export default function JournalCard({ data = {}, update }) {
  // ---- 1. PERSISTENT ACTIVE TAB ----
  const [activeNotesPage, setActiveNotesPage] = useState(() => {
    const saved = localStorage.getItem('vtt_active_journal_page');
    if (saved && !isNaN(Number(saved))) {
      return Number(saved);
    }
    return data.lastActiveNotesPage || 1;
  });

  const [collapsed, setCollapsed] = useState(true);
  const [editingTabName, setEditingTabName] = useState(null);
  const [tabInputText, setTabInputText] = useState('');

  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const migrationDone = useRef(false);
  const isInternalTyping = useRef(false);

  // ---- 2. NON-DESTRUCTIVE SAFE MIGRATION ----
  useEffect(() => {
    if (migrationDone.current) return;
    const oldNotes = data.notes;
    const hasPage1 = data.notesPages?.[1] !== undefined;

    if (oldNotes && typeof oldNotes === 'string' && oldNotes.trim() !== '' && !hasPage1) {
      const newPages = { ...(data.notesPages || {}), 1: convertLegacyTextToHTML(oldNotes) };
      update('notesPages', newPages);
      console.log('[JournalCard] Non-destructive migration: Legacy notes safely copied to Page 1.');
    }
    migrationDone.current = true;
  }, [data.notes, data.notesPages, update]);

  // Helper to convert old plain text / markdown newlines into HTML without losing text
  function convertLegacyTextToHTML(rawText) {
    if (!rawText) return '';
    if (rawText.includes('<p>') || rawText.includes('<div>') || rawText.includes('<br>') || rawText.includes('<h')) {
      return rawText;
    }
    return rawText
      .split('\n\n')
      .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
      .join('');
  }

  // ---- 3. Page and Title Accessors ----
  const notesPages = data.notesPages || {};
  const notesPageTitles = data.notesPageTitles || {};

  const availablePages = useMemo(() => {
    const existingKeys = Object.keys(notesPages).map(Number).filter(n => !isNaN(n));
    const defaultKeys = [1, 2, 3, 4, 5, 6];
    return Array.from(new Set([...defaultKeys, ...existingKeys])).sort((a, b) => a - b);
  }, [notesPages]);

  const getPageContent = useCallback((page) => {
    const raw = notesPages[page];
    if (!raw) return '';
    return convertLegacyTextToHTML(raw);
  }, [notesPages]);

  const getPageTitle = useCallback((page) => {
    return notesPageTitles[page] || `Page ${page}`;
  }, [notesPageTitles]);

  // Sync editor content when switching pages or loading
  useEffect(() => {
    if (editorRef.current && !isInternalTyping.current) {
      const content = getPageContent(activeNotesPage);
      if (editorRef.current.innerHTML !== content) {
        editorRef.current.innerHTML = content;
      }
    }
  }, [activeNotesPage, getPageContent]);

  // Select page and save last active state
  const handleSelectPage = (page) => {
    setActiveNotesPage(page);
    localStorage.setItem('vtt_active_journal_page', String(page));
    update('lastActiveNotesPage', page);
  };

  // Safe update for active page text
  const handleEditorInput = () => {
    if (!editorRef.current) return;
    isInternalTyping.current = true;
    const newHTML = editorRef.current.innerHTML;
    update('notesPages', { ...notesPages, [activeNotesPage]: newHTML });
    setTimeout(() => {
      isInternalTyping.current = false;
    }, 100);
  };

  // Rename Tab
  const handleRenameTab = (pageId, newTitle) => {
    const trimmed = (newTitle || '').trim();
    update('notesPageTitles', {
      ...notesPageTitles,
      [pageId]: trimmed || `Page ${pageId}`
    });
    setEditingTabName(null);
  };

  // Add a new tab page
  const handleAddPage = () => {
    const nextNum = Math.max(...availablePages, 0) + 1;
    update('notesPages', { ...notesPages, [nextNum]: '' });
    update('notesPageTitles', { ...notesPageTitles, [nextNum]: `Page ${nextNum}` });
    handleSelectPage(nextNum);
  };

  // ---- 4. WYSIWYG FORMATTING COMMANDS ----
  const executeCmd = (command, value = null) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, value);
    handleEditorInput();
  };

  const insertCustomHTML = (html) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const el = document.createElement('div');
      el.innerHTML = html;
      const frag = document.createDocumentFragment();
      let node;
      let lastNode;
      while ((node = el.firstChild)) {
        lastNode = frag.appendChild(node);
      }
      range.insertNode(frag);
      if (lastNode) {
        range.setStartAfter(lastNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    } else {
      editorRef.current.innerHTML += html;
    }
    handleEditorInput();
  };

  const handleHighlight = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const selectedText = selection.toString();
    insertCustomHTML(`<mark class="bg-yellow-400/30 text-yellow-200 px-1 py-0.5 rounded border-b border-yellow-400 font-medium">${selectedText}</mark>`);
  };

  // ---- 5. BACKUP EXPORT & IMPORT ----
  const handleExportJSON = () => {
    const backupData = {
      version: '2.0',
      exportDate: new Date().toISOString(),
      characterName: data.name || 'Hero',
      lastActiveNotesPage: activeNotesPage,
      notesPages: data.notesPages || {},
      notesPageTitles: data.notesPageTitles || {},
      traits: data.traits || '',
      ideals: data.ideals || '',
      bonds: data.bonds || '',
      flaws: data.flaws || '',
      backstory: data.backstory || '',
      notes: data.notes || ''
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (data.name || 'character').replace(/\s+/g, '_').toLowerCase();
    a.href = url;
    a.download = `${safeName}_journal_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportMarkdown = () => {
    let mdContent = `# Journal: ${data.name || 'Character'}\n\n`;

    if (data.backstory) mdContent += `## Backstory\n${data.backstory}\n\n`;
    if (data.traits || data.ideals || data.bonds || data.flaws) {
      mdContent += `## Personality & Traits\n`;
      if (data.traits) mdContent += `- **Traits:** ${data.traits}\n`;
      if (data.ideals) mdContent += `- **Ideals:** ${data.ideals}\n`;
      if (data.bonds) mdContent += `- **Bonds:** ${data.bonds}\n`;
      if (data.flaws) mdContent += `- **Flaws:** ${data.flaws}\n`;
      mdContent += `\n`;
    }

    mdContent += `## Notes\n\n`;
    availablePages.forEach((page) => {
      const title = getPageTitle(page);
      const html = notesPages[page] || '';
      // Strip html tags for plain markdown export
      const text = html.replace(/<br\s*[\/]?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]+>/gi, '');
      if (text.trim()) {
        mdContent += `### ${title}\n\n${text.trim()}\n\n---\n\n`;
      }
    });

    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (data.name || 'character').replace(/\s+/g, '_').toLowerCase();
    a.href = url;
    a.download = `${safeName}_notes_${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (!imported || typeof imported !== 'object') throw new Error('Invalid format');

        if (window.confirm('Importing this backup will safely merge with your current notes. Would you like to proceed?')) {
          if (imported.notesPages) {
            update('notesPages', { ...(data.notesPages || {}), ...imported.notesPages });
          }
          if (imported.notesPageTitles) {
            update('notesPageTitles', { ...(data.notesPageTitles || {}), ...imported.notesPageTitles });
          }
          if (imported.traits) update('traits', imported.traits);
          if (imported.ideals) update('ideals', imported.ideals);
          if (imported.bonds) update('bonds', imported.bonds);
          if (imported.flaws) update('flaws', imported.flaws);
          if (imported.backstory) update('backstory', imported.backstory);

          alert('✅ Journal backup imported successfully!');
        }
      } catch (err) {
        console.error('[JournalCard Import Error]:', err);
        alert('❌ Failed to import file. Please select a valid JSON backup.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const collapsibleFields = [
    { label: 'Personality Traits', id: 'traits' },
    { label: 'Ideals', id: 'ideals' },
    { label: 'Bonds', id: 'bonds' },
    { label: 'Flaws', id: 'flaws' },
    { label: 'Backstory', id: 'backstory' }
  ];

  return (
    <div className="bg-bgPanel p-4 rounded-xl border border-borderDark flex flex-col gap-4">
      {/* CLEAN HEADER */}
      <div className="flex items-center gap-2 border-b border-borderDark pb-3">
        <span className="text-base">📖</span>
        <h3 className="text-accentGold font-bold text-xs uppercase tracking-widest">
          Character Journal
        </h3>
      </div>

      {/* COLLAPSIBLE SECTION: PERSONALITY & BACKGROUND */}
      <div className="border border-borderDark rounded-lg overflow-hidden bg-bgDark/40">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex justify-between items-center p-2.5 bg-bgCard hover:bg-borderDark transition-colors"
        >
          <span className="text-accentGold text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
            <span>🎭</span> Personality & Background
          </span>
          <span className="text-accentGold text-xs font-bold">{collapsed ? '▼' : '▲'}</span>
        </button>
        {!collapsed && (
          <div className="p-3 space-y-3 border-t border-borderDark">
            {collapsibleFields.map(field => (
              <div key={field.id}>
                <label className="text-[9px] text-textMuted uppercase block mb-1 font-bold">
                  {field.label}
                </label>
                <textarea 
                  className="w-full bg-bgCard p-2 rounded text-xs text-textLight resize-y border border-borderDark focus:outline-none focus:border-accentGold"
                  rows="2"
                  value={data[field.id] || ''}
                  onChange={(e) => update(field.id, e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MULTI-PAGE NOTES MAIN SECTION */}
      <div className="flex flex-col gap-2">
        {/* TABS HEADER ROW */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Renamable Page Tabs */}
          <div className="flex items-center flex-wrap gap-1.5">
            {availablePages.map(page => {
              const isActive = activeNotesPage === page;
              const title = getPageTitle(page);
              const isEditingThisTab = editingTabName === page;

              return (
                <div key={page} className="relative group">
                  {isEditingThisTab ? (
                    <input
                      type="text"
                      autoFocus
                      value={tabInputText}
                      onChange={(e) => setTabInputText(e.target.value)}
                      onBlur={() => handleRenameTab(page, tabInputText)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') handleRenameTab(page, tabInputText);
                        if (e.key === 'Escape') setEditingTabName(null);
                      }}
                      className="px-2 py-1 text-[10px] font-bold rounded bg-bgPanel border border-accentGold text-accentGold w-28 focus:outline-none shadow-md"
                    />
                  ) : (
                    <button
                      onClick={() => handleSelectPage(page)}
                      onDoubleClick={() => {
                        setTabInputText(title);
                        setEditingTabName(page);
                      }}
                      className={`px-3 py-1.5 text-[10px] font-bold rounded-lg border transition-all flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-accentGold text-black border-accentGold shadow-md font-extrabold'
                          : 'bg-bgCard text-textMuted border-borderDark hover:border-accentGold/60 hover:text-textLight'
                      }`}
                    >
                      <span className="truncate max-w-[120px]">{title}</span>
                      {isActive && (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setTabInputText(title);
                            setEditingTabName(page);
                          }}
                          title="Rename Tab (or double click)"
                          className="opacity-60 hover:opacity-100 hover:text-black cursor-pointer text-[9px]"
                        >
                          ✎
                        </span>
                      )}
                    </button>
                  )}
                </div>
              );
            })}

            {/* Add New Page Button */}
            <button
              onClick={handleAddPage}
              title="Add new journal tab"
              className="px-2.5 py-1 text-[10px] font-extrabold rounded-lg bg-bgCard border border-dashed border-borderDark hover:border-accentGold text-accentGold transition-all"
            >
              + Add Tab
            </button>
          </div>

          <span className="text-[9px] text-textMuted italic">
            Double-click tab to rename • Auto-saves
          </span>
        </div>

        {/* RICH FORMATTING TOOLBAR */}
        <div className="flex flex-wrap items-center gap-1 p-1.5 bg-bgCard border border-borderDark rounded-lg text-xs shadow-sm">
          <button
            type="button"
            onClick={() => executeCmd('bold')}
            title="Bold"
            className="px-2 py-0.5 rounded bg-bgPanel hover:bg-borderDark text-accentGold font-black"
          >
            B
          </button>
          <button
            type="button"
            onClick={() => executeCmd('italic')}
            title="Italic"
            className="px-2 py-0.5 rounded bg-bgPanel hover:bg-borderDark text-accentGold italic font-serif"
          >
            I
          </button>
          <button
            type="button"
            onClick={() => executeCmd('strikeThrough')}
            title="Strikethrough"
            className="px-2 py-0.5 rounded bg-bgPanel hover:bg-borderDark text-accentGold line-through"
          >
            S
          </button>
          <button
            type="button"
            onClick={handleHighlight}
            title="Highlight Selection"
            className="px-2 py-0.5 rounded bg-bgPanel hover:bg-borderDark text-yellow-300 font-bold"
          >
            🖍️ Highlight
          </button>

          <span className="h-4 w-px bg-borderDark mx-1" />

          <button
            type="button"
            onClick={() => executeCmd('formatBlock', '<h1>')}
            title="Large Heading"
            className="px-2 py-0.5 rounded bg-bgPanel hover:bg-borderDark text-[10px] font-bold text-textLight"
          >
            H1
          </button>
          <button
            type="button"
            onClick={() => executeCmd('formatBlock', '<h2>')}
            title="Medium Heading"
            className="px-2 py-0.5 rounded bg-bgPanel hover:bg-borderDark text-[10px] font-bold text-textLight"
          >
            H2
          </button>
          <button
            type="button"
            onClick={() => executeCmd('formatBlock', '<h3>')}
            title="Subheading"
            className="px-2 py-0.5 rounded bg-bgPanel hover:bg-borderDark text-[10px] font-bold text-textLight"
          >
            H3
          </button>
          <button
            type="button"
            onClick={() => executeCmd('formatBlock', '<p>')}
            title="Normal Paragraph"
            className="px-2 py-0.5 rounded bg-bgPanel hover:bg-borderDark text-[10px] font-bold text-textMuted"
          >
            Text
          </button>

          <span className="h-4 w-px bg-borderDark mx-1" />

          <button
            type="button"
            onClick={() => insertCustomHTML('<div class="flex items-center gap-2 my-1"><input type="checkbox" class="accent-accentGold w-3.5 h-3.5 rounded cursor-pointer"><span>New Task</span></div>')}
            title="Add Checkbox / Quest Task"
            className="px-2 py-0.5 rounded bg-bgPanel hover:bg-borderDark text-[10px] font-bold text-textLight flex items-center gap-1"
          >
            ☑ <span>Task</span>
          </button>
          <button
            type="button"
            onClick={() => executeCmd('insertUnorderedList')}
            title="Bullet List"
            className="px-2 py-0.5 rounded bg-bgPanel hover:bg-borderDark text-[10px] font-bold text-textLight"
          >
            • Bullet
          </button>

          <span className="h-4 w-px bg-borderDark mx-1" />

          <button
            type="button"
            onClick={() => insertCustomHTML('<div class="border-l-4 border-yellow-400 bg-yellow-950/30 text-yellow-200 p-2 my-2 rounded-r font-semibold">📜 <b>Quest:</b> Enter quest objective here...</div>')}
            title="Insert Quest Objective Box"
            className="px-2 py-0.5 rounded bg-bgPanel hover:bg-borderDark text-[10px] font-bold text-yellow-300"
          >
            📜 Quest
          </button>
          <button
            type="button"
            onClick={() => insertCustomHTML('<div class="border-l-4 border-sky-400 bg-sky-950/30 text-sky-200 p-2 my-2 rounded-r">ℹ️ <b>Note:</b> Enter clue or NPC details...</div>')}
            title="Insert Info Box"
            className="px-2 py-0.5 rounded bg-bgPanel hover:bg-borderDark text-[10px] font-bold text-sky-300"
          >
            ℹ️ Info
          </button>
          <button
            type="button"
            onClick={() => insertCustomHTML('<div class="border-l-4 border-emerald-400 bg-emerald-950/30 text-emerald-200 p-2 my-2 rounded-r">💎 <b>Loot:</b> 100 GP, Magic Ring...</div>')}
            title="Insert Loot Box"
            className="px-2 py-0.5 rounded bg-bgPanel hover:bg-borderDark text-[10px] font-bold text-emerald-300"
          >
            💎 Loot
          </button>
          <button
            type="button"
            onClick={() => insertCustomHTML('<details class="my-2 border border-accentGold/30 bg-bgCard rounded-lg p-2"><summary class="text-accentGold text-xs font-bold uppercase cursor-pointer">▶ Secret Details</summary><div class="p-2 text-xs text-textLight">Hidden spoiler notes...</div></details>')}
            title="Insert Collapsible Section"
            className="px-2 py-0.5 rounded bg-bgPanel hover:bg-borderDark text-[10px] font-bold text-amber-300"
          >
            📂 Spoiler
          </button>
          <button
            type="button"
            onClick={() => insertCustomHTML('<hr class="my-3 border-borderDark">')}
            title="Divider Line"
            className="px-2 py-0.5 rounded bg-bgPanel hover:bg-borderDark text-[10px] font-bold text-textMuted"
          >
            ➖ Line
          </button>
        </div>

        {/* UNIFIED FORMATTED WYSIWYG NOTE SHEET */}
        <div className="relative">
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleEditorInput}
            onKeyDown={(e) => {
              // 1. Isolate keyboard events so canvas/pan listeners never steal spaces or letters
              e.stopPropagation();

              // 2. Allow Tab key to indent cleanly inside notes
              if (e.key === 'Tab') {
                e.preventDefault();
                document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;');
                handleEditorInput();
              }
            }}
            onKeyUp={(e) => e.stopPropagation()}
            onKeyPress={(e) => e.stopPropagation()}
            className="w-full bg-bgCard p-4 rounded-xl text-xs min-h-[500px] border border-borderDark focus:outline-none focus:border-accentGold leading-relaxed select-text shadow-inner text-textLight overflow-y-auto journal-wysiwyg"
            style={{ minHeight: '520px' }}
          />
        </div>

        {/* FOOTER ACTION BAR: IMPORT, BACKUP, AND EXPORT AT THE VERY BOTTOM */}
        <div className="flex flex-wrap items-center justify-between pt-3 border-t border-borderDark/60 mt-2 text-[10px]">
          <span className="text-textMuted text-[9px] italic">
            Keep your notes backed up safely to your device.
          </span>

          <div className="flex items-center gap-1.5">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportFile}
              accept=".json"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Import journal backup JSON"
              className="px-2.5 py-1 rounded bg-bgCard border border-borderDark hover:border-accentGold text-[10px] font-bold text-textMuted hover:text-accentGold transition-all flex items-center gap-1 shadow-sm"
            >
              📥 <span>Import Backup</span>
            </button>

            <button
              onClick={handleExportJSON}
              title="Download safe JSON backup of all notes"
              className="px-2.5 py-1 rounded bg-bgCard border border-borderDark hover:border-accentGold text-[10px] font-bold text-textMuted hover:text-accentGold transition-all flex items-center gap-1 shadow-sm"
            >
              💾 <span>Save Backup</span>
            </button>

            <button
              onClick={handleExportMarkdown}
              title="Export as Markdown (.md)"
              className="px-2.5 py-1 rounded bg-bgCard border border-borderDark hover:border-accentGold text-[10px] font-bold text-textMuted hover:text-accentGold transition-all flex items-center gap-1 shadow-sm"
            >
              📄 <span>Export .MD</span>
            </button>
          </div>
        </div>
      </div>

      {/* Styled Headings and Content Styling */}
      <style>{`
        .journal-wysiwyg {
          white-space: pre-wrap;
          word-break: break-word;
        }
        .journal-wysiwyg h1 {
          font-size: 1.25rem;
          font-weight: 900;
          color: #fbbf24;
          border-bottom: 2px solid rgba(230, 180, 34, 0.4);
          padding-bottom: 4px;
          margin-top: 14px;
          margin-bottom: 8px;
        }
        .journal-wysiwyg h2 {
          font-size: 1.1rem;
          font-weight: 800;
          color: #fef08a;
          border-bottom: 1px solid rgba(230, 180, 34, 0.25);
          padding-bottom: 3px;
          margin-top: 12px;
          margin-bottom: 6px;
        }
        .journal-wysiwyg h3 {
          font-size: 0.95rem;
          font-weight: 700;
          color: #fde047;
          margin-top: 10px;
          margin-bottom: 4px;
        }
        .journal-wysiwyg ul {
          list-style-type: disc;
          padding-left: 1.25rem;
          margin: 6px 0;
        }
        .journal-wysiwyg ol {
          list-style-type: decimal;
          padding-left: 1.25rem;
          margin: 6px 0;
        }
        .journal-wysiwyg p {
          margin: 4px 0;
        }
        .journal-wysiwyg hr {
          border-color: #2d303a;
          margin: 12px 0;
        }
        .journal-wysiwyg mark {
          background-color: rgba(250, 204, 21, 0.25);
          color: #fef08a;
          padding: 2px 4px;
          border-radius: 4px;
          border-bottom: 1px solid #eab308;
        }
      `}</style>
    </div>
  );
}