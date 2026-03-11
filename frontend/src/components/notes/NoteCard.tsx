import React, { useMemo, useState } from 'react';
import { Trash2, Copy, MoreVertical, Star, AlertTriangle, CheckSquare, Heart } from 'lucide-react';
import type { Note, Folder, Tag } from '../../types';
import { Badge } from '../ui/Badge';

interface NoteCardProps {
  note: Note;
  isSelected: boolean;
  folders: Folder[];
  showFolderSubtitle?: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, folderId: string | null) => Promise<void>;
  onCopy: (id: string, targetFolderId?: string | null) => Promise<Note>;
  onDelete: (id: string) => Promise<void>;
  onToggleFavorite?: (id: string) => void | Promise<void>;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export const NoteCard: React.FC<NoteCardProps> = ({
  note,
  isSelected,
  folders,
  showFolderSubtitle = false,
  onSelect,
  onMove,
  onCopy,
  onDelete,
  onToggleFavorite,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copying, setCopying] = useState(false);

  const preview = note.content
    .replace(/\n+/g, ' ')
    .trim()
    .slice(0, 100);

  const folderName = note.folderId
    ? folders.find((f) => f.id === note.folderId)?.name
    : null;

  const systemTagMeta: Record<string, { icon: React.ReactNode }> = useMemo(
    () => ({
      Pinned: { icon: <Star className="w-3 h-3 mr-1" /> },
      Important: { icon: <AlertTriangle className="w-3 h-3 mr-1" /> },
      Todo: { icon: <CheckSquare className="w-3 h-3 mr-1" /> },
    }),
    []
  );

  const visibleTags: Tag[] = (note.tags ?? []).filter((t) =>
    Object.prototype.hasOwnProperty.call(systemTagMeta, t.name)
  );

  const isFavorite = (note.tags ?? []).some((t) => t.name === 'Important');

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = window.confirm('Delete this note? This cannot be undone.');
    if (!ok) return;
    setIsDeleting(true);
    try {
      await onDelete(note.id);
    } catch {
      setIsDeleting(false);
    }
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    setCopying(true);
    try {
      await onCopy(note.id);
    } catch {
      setCopying(false);
    }
  };

  const handleMoveTo = async (e: React.MouseEvent, folderId: string | null) => {
    e.stopPropagation();
    setMenuOpen(false);
    try {
      await onMove(note.id, folderId);
    } catch {
      // keep UI as-is on error
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(note.id)}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(note.id)}
      className={`
        group w-full text-left px-3 py-3 rounded-xl cursor-pointer
        transition-all duration-150
        focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
        ${isDeleting ? 'opacity-0 scale-95 pointer-events-none' : ''}
        ${
          isSelected
            ? 'bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800'
            : 'hover:bg-gray-100 dark:hover:bg-gray-800/70 border border-transparent'
        }
      `}
      aria-selected={isSelected}
    >
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="min-w-0 flex-1">
          {/* Title */}
          <h3
            className={`
              text-sm font-semibold truncate
              ${
                isSelected
                  ? 'text-indigo-700 dark:text-indigo-300'
                  : 'text-gray-900 dark:text-gray-50'
              }
            `}
          >
            {note.title || 'Untitled Note'}
          </h3>

          {/* Folder subtitle (only on All Notes) */}
          {showFolderSubtitle && (
            <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-600 truncate">
              {folderName ?? 'No folder'}
            </p>
          )}
        </div>

        {/* Actions: heart + menu + delete */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {onToggleFavorite && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(note.id);
              }}
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              className={`
                flex-shrink-0 p-1 rounded-md transition-all duration-150
                focus:outline-none focus:opacity-100 focus:ring-1 focus:ring-pink-500
                ${isFavorite ? 'text-pink-500 opacity-100' : 'opacity-0 group-hover:opacity-100 text-gray-300 dark:text-gray-500 hover:text-pink-500 hover:bg-pink-50 dark:hover:bg-pink-950/40'}
              `}
            >
              <Heart size={13} className={isFavorite ? 'fill-current' : ''} />
            </button>
          )}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((o) => !o);
              }}
              title="Move or copy"
              className="
                opacity-0 group-hover:opacity-100
                p-1 rounded-md text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40
                transition-all duration-150 focus:outline-none focus:opacity-100 focus:ring-1 focus:ring-indigo-500
              "
            >
              <MoreVertical size={14} />
            </button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  aria-hidden
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                  }}
                />
                <div
                  className="absolute right-0 top-full mt-1 py-1 min-w-[160px] rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg z-20"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={handleCopy}
                    disabled={copying}
                    className="w-full px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <Copy size={12} />
                    {copying ? 'Copying…' : 'Duplicate note'}
                  </button>
                  <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                  <div className="px-2 py-1.5 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                    Move to folder
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleMoveTo(e, null)}
                    className="w-full px-3 py-2 text-left text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    No folder
                  </button>
                  {folders.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={(e) => handleMoveTo(e, f.id)}
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
          onClick={handleDelete}
          title="Delete note"
          className="
            opacity-0 group-hover:opacity-100
            flex-shrink-0 p-1 rounded-md
            text-gray-400 hover:text-red-500
            hover:bg-red-50 dark:hover:bg-red-950/40
            transition-all duration-150
            focus:outline-none focus:opacity-100 focus:ring-1 focus:ring-red-500
          "
        >
          <Trash2 size={13} />
        </button>
      </div>
      </div>

      {/* Content preview */}
      {preview ? (
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
          {preview}
          {note.content.length > 100 && '…'}
        </p>
      ) : (
        <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-600 italic">
          No content
        </p>
      )}

      {/* Tags + timestamp */}
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {visibleTags.map((tag) => (
            <Badge
              key={tag.id}
              color="indigo"
              className="text-[10px] px-1.5 py-0.5"
            >
              <span className="inline-flex items-center">
                {systemTagMeta[tag.name]?.icon}
                <span>{tag.name}</span>
              </span>
            </Badge>
          ))}
        </div>
        <p
          className={`
            text-xs
            ${
              isSelected
                ? 'text-indigo-500 dark:text-indigo-400'
                : 'text-gray-400 dark:text-gray-600'
            }
          `}
        >
          {formatRelativeTime(note.updatedAt)}
        </p>
      </div>
    </div>
  );
};
