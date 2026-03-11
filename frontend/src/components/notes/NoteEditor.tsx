import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  Check,
  AlertCircle,
  Loader2,
  Trash2,
  StickyNote,
  Plus,
  Copy,
  FolderInput,
  Star,
  AlertTriangle,
  CheckSquare,
} from 'lucide-react';
import type { Note, SaveStatus, Folder, Tag } from '../../types';
import { addTagToNote, ensureSystemTags, getTagsForNote, removeTagFromNote } from '../../services/api';
import { Badge } from '../ui/Badge';
import { summarizeNote } from '../../services/summarizer';

interface NoteEditorProps {
  note: Note | null;
  saveStatus: SaveStatus;
  isAuthenticated: boolean;
  folders: Folder[];
  onUpdate: (
    id: string,
    partial: Partial<Pick<Note, 'title' | 'content'>>
  ) => Promise<void>;
  onCreate: (title: string, content: string) => Promise<Note>;
  onMove: (id: string, folderId: string | null) => Promise<void>;
  onCopy: (id: string, targetFolderId?: string | null) => Promise<Note>;
  onDelete: (id: string) => Promise<void>;
  onTagsChange?: (id: string, tags: Tag[]) => void;
}

const AUTOSAVE_DELAY_MS = 800;

/**
 * Right-panel editor.
 *
 * - Title: large borderless input
 * - Content: auto-resizing textarea
 * - Auto-saves with 800ms debounce on every keystroke
 * - Displays SaveStatus indicator in the toolbar
 * - Shows a beautiful empty state when no note is selected
 */
export const NoteEditor: React.FC<NoteEditorProps> = ({
  note,
  saveStatus,
  isAuthenticated,
  folders,
  onUpdate,
  onCreate,
  onMove,
  onCopy,
  onDelete,
  onTagsChange,
}) => {
  const [title, setTitle] = useState(note?.title ?? '');
  const [content, setContent] = useState(note?.content ?? '');
  const [localSaveStatus, setLocalSaveStatus] =
    useState<SaveStatus>('idle');
  const [isDeleting, setIsDeleting] = useState(false);
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
  const [copying, setCopying] = useState(false);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);

  const systemTagMeta: Record<string, { icon: React.ReactNode }> = {
    Pinned: { icon: <Star className="w-3 h-3 mr-1" /> },
    Important: { icon: <AlertTriangle className="w-3 h-3 mr-1" /> },
    Todo: { icon: <CheckSquare className="w-3 h-3 mr-1" /> },
  };

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentNoteId = useRef<string | null>(note?.id ?? null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  // Sync local state when note changes (selecting a different note)
  useEffect(() => {
    if (note?.id !== currentNoteId.current) {
      setTitle(note?.title ?? '');
      setContent(note?.content ?? '');
      currentNoteId.current = note?.id ?? null;
      setLocalSaveStatus('idle');
      setSelectedTagIds(new Set(note?.tags?.map((t) => t.id) ?? []));
      setSummary('');

      // Clear any pending auto-save from the previous note
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    }
  }, [note]);

  // Load tags from Supabase when a note is selected
  useEffect(() => {
    if (!note || !isAuthenticated) return;
    let cancelled = false;

    (async () => {
      try {
        const [systemTags, noteTags] = await Promise.all([
          ensureSystemTags(),
          getTagsForNote(note.id),
        ]);
        if (cancelled) return;
        setAvailableTags(systemTags);
        setSelectedTagIds(new Set(noteTags.map((t) => t.id)));
      } catch {
        // ignore; tags UI is optional
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [note?.id, isAuthenticated]);

  // Auto-resize textarea to content height
  useLayoutEffect(() => {
    if (contentRef.current) {
      contentRef.current.style.height = 'auto';
      contentRef.current.style.height = `${contentRef.current.scrollHeight}px`;
    }
  }, [content]);

  // Focus the title input when a brand-new (empty) note is selected
  useEffect(() => {
    if (note && !note.title && !note.content) {
      titleRef.current?.focus();
    }
  }, [note?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const scheduleAutoSave = useCallback(
    (newTitle: string, newContent: string) => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

      autoSaveTimer.current = setTimeout(async () => {
        const id = currentNoteId.current;
        if (!id) return;

        const isEmpty =
          (newTitle?.trim() ?? '').length === 0 &&
          (newContent?.trim() ?? '').length === 0;

        // If a note becomes completely empty, delete it automatically
        if (isEmpty) {
          try {
            await onDelete(id);
          } finally {
            currentNoteId.current = null;
            setLocalSaveStatus('idle');
          }
          return;
        }

        setLocalSaveStatus('saving');
        try {
          await onUpdate(id, { title: newTitle, content: newContent });
          setLocalSaveStatus('saved');
          setTimeout(() => setLocalSaveStatus('idle'), 2000);
        } catch {
          setLocalSaveStatus('error');
        }
      }, AUTOSAVE_DELAY_MS);
    },
    [onUpdate, onDelete]
  );

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);
    scheduleAutoSave(val, content);
  };

  const handleContentChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    const val = e.target.value;
    setContent(val);
    scheduleAutoSave(title, val);
  };

  const handleSummarize = async () => {
    if (!note) return;
    const baseTitle = title || note.title;
    const baseContent = content || note.content;
    if (!baseTitle.trim() && !baseContent.trim()) return;
    setIsSummarizing(true);
    try {
      const s = await summarizeNote(baseTitle, baseContent);
      setSummary(s || 'No summary available.');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleDelete = async () => {
    if (!currentNoteId.current) return;
    const ok = window.confirm('Delete this note? This cannot be undone.');
    if (!ok) return;
    setIsDeleting(true);
    try {
      await onDelete(currentNoteId.current);
    } catch {
      setIsDeleting(false);
    }
  };

  // Effective status: local (in-editor) takes precedence over hook-level
  const effectiveStatus =
    localSaveStatus !== 'idle' ? localSaveStatus : saveStatus;

  const wordCount = content.split(/\s+/).filter(Boolean).length;

  const toggleTag = async (tag: Tag) => {
    if (!note || !isAuthenticated) return;
    const previous = new Set(selectedTagIds);
    const hasTag = previous.has(tag.id);
    const next = new Set(previous);
    if (hasTag) next.delete(tag.id); else next.add(tag.id);
    setSelectedTagIds(next);
    try {
      if (hasTag) {
        await removeTagFromNote(note.id, tag.id);
      } else {
        await addTagToNote(note.id, tag.id);
      }
      if (onTagsChange) {
        const updatedTags = availableTags.filter((t) => next.has(t.id));
        onTagsChange(note.id, updatedTags);
      }
    } catch {
      setSelectedTagIds(previous);
    }
  };

  // ------------------------------------------------------------------
  // Empty state — no note selected
  // ------------------------------------------------------------------
  if (!note) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8 bg-white dark:bg-gray-950 select-none animate-fade-in">
        <div className="p-6 rounded-3xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
          <StickyNote
            size={48}
            className="text-gray-300 dark:text-gray-700"
          />
        </div>
        <div className="text-center max-w-xs">
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Select a note to start editing
          </h2>
          <p className="text-sm text-gray-400 dark:text-gray-600 leading-relaxed">
            Pick a note from the list, or create a new one to get started.
          </p>
        </div>
        <button
          onClick={() => isAuthenticated ? onCreate('', '') : (window.location.href = '/login')}
          className="
            inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium
            bg-indigo-600 hover:bg-indigo-700 text-white
            shadow-sm shadow-indigo-500/25
            transition-all duration-150 active:scale-95
            focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
            dark:focus:ring-offset-gray-950
          "
        >
          <Plus size={16} />
          New note
        </button>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Editor
  // ------------------------------------------------------------------
  const createdDate = new Date(note.createdAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const updatedDate = new Date(note.updatedAt).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-950 animate-fade-in">
      {/* ---------------------------------------------------------------- */}
      {/* Toolbar                                                           */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 dark:border-gray-800 flex-shrink-0 min-h-[52px]">
        {/* Save status */}
        <div className="flex items-center gap-1.5 text-xs h-5">
          {effectiveStatus === 'saving' && (
            <span className="flex items-center gap-1.5 text-amber-500 dark:text-amber-400">
              <Loader2 size={13} className="animate-spin" />
              Saving…
            </span>
          )}
          {effectiveStatus === 'saved' && (
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 animate-fade-in">
              <Check size={13} />
              Saved
            </span>
          )}
          {effectiveStatus === 'error' && (
            <span className="flex items-center gap-1.5 text-red-500 dark:text-red-400">
              <AlertCircle size={13} />
              Save failed
            </span>
          )}
          {effectiveStatus === 'idle' && (
            <span className="text-gray-300 dark:text-gray-700">
              Edited {updatedDate}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {note && (
            <>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMoveMenuOpen((o) => !o)}
                  title="Move to folder"
                  className="
                    p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400
                    hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-all duration-150
                    focus:outline-none focus:ring-2 focus:ring-indigo-500
                  "
                >
                  <FolderInput size={15} />
                </button>
                {moveMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      aria-hidden
                      onClick={() => setMoveMenuOpen(false)}
                    />
                    <div
                      className="absolute left-0 top-full mt-1 py-1 min-w-[180px] rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg z-20"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="px-2 py-1.5 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                        Move to folder
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onMove(note.id, null);
                          setMoveMenuOpen(false);
                        }}
                        className="w-full px-3 py-2 text-left text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        No folder
                      </button>
                      {folders.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => {
                            onMove(note.id, f.id);
                            setMoveMenuOpen(false);
                          }}
                          className="w-full px-3 py-2 text-left text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: f.color }}
                          />
                          {f.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={async () => {
                  setCopying(true);
                  try {
                    await onCopy(note.id);
                  } finally {
                    setCopying(false);
                  }
                }}
                disabled={copying}
                title="Duplicate note"
                className="
                  p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400
                  hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-all duration-150
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50
                "
              >
                <Copy size={15} />
              </button>
            </>
          )}
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            title="Delete note"
            className="
              p-1.5 rounded-lg
              text-gray-400 hover:text-red-500 dark:hover:text-red-400
              hover:bg-red-50 dark:hover:bg-red-950/40
              transition-all duration-150
              focus:outline-none focus:ring-2 focus:ring-red-500
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            {isDeleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Writing area                                                      */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-2xl mx-auto px-8 md:px-12 py-10">
          {/* Title */}
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={handleTitleChange}
            placeholder="Untitled Note"
            className="
              w-full text-3xl font-bold
              text-gray-900 dark:text-gray-50
              placeholder:text-gray-200 dark:placeholder:text-gray-800
              bg-transparent border-none outline-none
              mb-2 leading-tight
            "
          />

          {/* Summary (Groq) — right below title */}
          <div className="mb-4 rounded-xl border border-indigo-100 dark:border-indigo-900 bg-indigo-50/70 dark:bg-indigo-950/40 px-3 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-indigo-900 dark:text-indigo-100 leading-snug">
                  <span className="mr-1" aria-hidden="true">🔍</span>
                  {summary
                    ? summary
                    : 'No summary yet. Click "Summarize" to generate a short overview.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleSummarize}
                disabled={isSummarizing || (!title.trim() && !content.trim())}
                title="Summarize this note using Groq AI"
                className="flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSummarizing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Summarizing…
                  </>
                ) : (
                  'Summarize'
                )}
              </button>
            </div>
          </div>

          {/* Metadata row */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <p className="text-xs text-gray-400 dark:text-gray-600">
              Created {createdDate}
            </p>
            {availableTags.length > 0 && (
              <div className="flex flex-wrap gap-1 justify-end">
                {availableTags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className="focus:outline-none"
                  >
                    <Badge
                      color={selectedTagIds.has(tag.id) ? 'indigo' : 'gray'}
                      className={selectedTagIds.has(tag.id)
                        ? 'shadow-sm shadow-indigo-500/20'
                        : 'opacity-80 hover:opacity-100'}
                    >
                      <span className="inline-flex items-center">
                        {systemTagMeta[tag.name]?.icon}
                        <span>{tag.name}</span>
                      </span>
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Content */}
          <textarea
            ref={contentRef}
            value={content}
            onChange={handleContentChange}
            placeholder="Start writing…"
            className="
              w-full text-base leading-relaxed
              text-gray-700 dark:text-gray-300
              placeholder:text-gray-300 dark:placeholder:text-gray-700
              bg-transparent border-none outline-none resize-none
              min-h-96
            "
          />
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Footer stats                                                      */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex-shrink-0 px-8 md:px-12 py-2.5 border-t border-gray-50 dark:border-gray-900">
        <div className="max-w-2xl mx-auto flex items-center gap-4 text-xs text-gray-300 dark:text-gray-700">
          <span>
            {wordCount} {wordCount === 1 ? 'word' : 'words'}
          </span>
          <span>
            {content.length}{' '}
            {content.length === 1 ? 'character' : 'characters'}
          </span>
        </div>
      </div>
    </div>
  );
};
