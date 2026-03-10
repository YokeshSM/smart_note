import { useCallback, useEffect, useRef, useState } from 'react';
import type { Note, SaveStatus, Tag } from '../types';
import {
  getNotes,
  createNote,
  updateNote,
  trashNote,
  copyNote as apiCopyNote,
  deleteNote as apiDeleteNote,
  ensureSystemTags,
  addTagToNote,
  removeTagFromNote,
} from '../services/api';

const PAGE_SIZE = 20;

interface UseNotesReturn {
  notes: Note[];
  isLoading: boolean;
  error: string | null;
  saveStatus: SaveStatus;
  selectedNote: Note | null;
  selectNote: (id: string) => void;
  createNote: (title: string, content: string) => Promise<Note>;
  updateNote: (id: string, partial: Partial<Pick<Note, 'title' | 'content'>>) => Promise<void>;
  moveNote: (id: string, folderId: string | null) => Promise<void>;
  copyNote: (id: string, targetFolderId?: string | null) => Promise<Note>;
  deleteNote: (id: string) => Promise<void>;
  hardDeleteNote: (id: string) => Promise<void>;
  loadMore: () => void;
  hasMore: boolean;
  search: string;
  setSearch: (s: string) => void;
  filteredNotes: Note[];
  filter: 'all' | 'pinned' | 'favorites';
  setFilter: (f: 'all' | 'pinned' | 'favorites') => void;
  updateNoteTags: (id: string, tags: Tag[]) => void;
  toggleFavorite: (id: string) => Promise<void>;
}

export function useNotes(isAuthenticated: boolean, folderId?: string | null): UseNotesReturn {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'pinned' | 'favorites'>('all');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingMoreRef = useRef(false);

  // Initial load
  useEffect(() => {
    if (!isAuthenticated) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setPage(1);

    getNotes(1, PAGE_SIZE, folderId)
      .then((result) => {
        setNotes(result.data);
        setHasMore(result.hasMore);
        setError(null);
      })
      .catch((err) => {
        setError(err?.message ?? 'Failed to load notes');
      })
      .finally(() => setIsLoading(false));
  }, [isAuthenticated, folderId]);

  const loadMore = useCallback(() => {
    if (loadingMoreRef.current || !hasMore || !isAuthenticated) return;

    const nextPage = page + 1;
    loadingMoreRef.current = true;

    getNotes(nextPage, PAGE_SIZE, folderId)
      .then((result) => {
        setNotes((prev) => {
          const existingIds = new Set(prev.map((n) => n.id));
          const fresh = result.data.filter((n) => !existingIds.has(n.id));
          return [...prev, ...fresh];
        });
        setHasMore(result.hasMore);
        setPage(nextPage);
      })
      .catch(() => {
        // Silently ignore — user can retry by scrolling again
      })
      .finally(() => {
        loadingMoreRef.current = false;
      });
  }, [hasMore, isAuthenticated, page, folderId]);

  const selectNote = useCallback((id: string) => {
    setSelectedNoteId(id);
  }, []);

  const showSaveStatus = useCallback((status: SaveStatus) => {
    setSaveStatus(status);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (status === 'saved') {
      saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2500);
    }
  }, []);

  const handleCreateNote = useCallback(
    async (title: string, content: string): Promise<Note> => {
      // Optimistic: add a temporary note immediately
      const tempId = `temp-${Date.now()}`;
      const now = new Date().toISOString();
      const tempNote: Note = {
        id: tempId,
        userId: '',
        folderId: null,
        title: title || 'Untitled Note',
        content,
        isPinned: false,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      };

      setNotes((prev) => [tempNote, ...prev]);
      setSelectedNoteId(tempId);

      try {
        const created = await createNote(title || 'Untitled Note', content);
        // Replace temp with real note
        setNotes((prev) =>
          prev.map((n) => (n.id === tempId ? created : n))
        );
        setSelectedNoteId(created.id);
        return created;
      } catch (err) {
        // Roll back
        setNotes((prev) => prev.filter((n) => n.id !== tempId));
        setSelectedNoteId(null);
        throw err;
      }
    },
    []
  );

  const handleUpdateNote = useCallback(
    async (
      id: string,
      partial: Partial<Pick<Note, 'title' | 'content'>>
    ): Promise<void> => {
      // Optimistic update
      const updatedAt = new Date().toISOString();
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, ...partial, updatedAt } : n))
      );
      showSaveStatus('saving');

      try {
        const updated = await updateNote(id, partial);
        setNotes((prev) => prev.map((n) => (n.id === id ? updated : n)));
        showSaveStatus('saved');
      } catch {
        showSaveStatus('error');
        // Note: we leave the optimistic state as-is to avoid data loss UX
      }
    },
    [showSaveStatus]
  );

  const handleDeleteNote = useCallback(
    async (id: string): Promise<void> => {
      // Optimistic removal (soft delete / trash)
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (selectedNoteId === id) setSelectedNoteId(null);

      try {
        await trashNote(id);
      } catch {
        // Re-fetch page 1 to reconcile on failure
        getNotes(1, PAGE_SIZE)
          .then((result) => {
            setNotes(result.data);
            setHasMore(result.hasMore);
          })
          .catch(() => {});
      }
    },
    [selectedNoteId]
  );

  const handleHardDeleteNote = useCallback(
    async (id: string): Promise<void> => {
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (selectedNoteId === id) setSelectedNoteId(null);

      try {
        await apiDeleteNote(id);
      } catch {
        // If hard delete fails, we silently ignore — the note was empty anyway.
      }
    },
    [selectedNoteId]
  );

  const handleMoveNote = useCallback(
    async (id: string, folderId: string | null): Promise<void> => {
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, folderId, updatedAt: new Date().toISOString() } : n))
      );
      try {
        const updated = await updateNote(id, { folderId });
        setNotes((prev) => prev.map((n) => (n.id === id ? updated : n)));
      } catch {
        getNotes(1, PAGE_SIZE, folderId).then((result) => {
          setNotes(result.data);
          setHasMore(result.hasMore);
        }).catch(() => {});
      }
    },
    []
  );

  const handleCopyNote = useCallback(
    async (id: string, targetFolderId?: string | null): Promise<Note> => {
      const created = await apiCopyNote(id, targetFolderId);
      setNotes((prev) => [created, ...prev]);
      setSelectedNoteId(created.id);
      return created;
    },
    []
  );

  const updateNoteTags = useCallback((id: string, tags: Tag[]) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, tags } : n))
    );
  }, []);

  const toggleFavorite = useCallback(
    async (id: string): Promise<void> => {
      const current = notes.find((n) => n.id === id);
      if (!current) return;

      const hasImportant = (current.tags ?? []).some((t) => t.name === 'Important');

      if (hasImportant) {
        const importantTag = (current.tags ?? []).find((t) => t.name === 'Important');
        if (!importantTag) return;

        // Optimistic update: remove Important tag locally
        setNotes((prev) =>
          prev.map((n) =>
            n.id === id
              ? { ...n, tags: (n.tags ?? []).filter((t) => t.id !== importantTag.id) }
              : n
          )
        );

        try {
          await removeTagFromNote(id, importantTag.id);
        } catch {
          // best-effort only; ignore error
        }
      } else {
        try {
          const systemTags = await ensureSystemTags();
          const importantTag = systemTags.find((t) => t.name === 'Important');
          if (!importantTag) return;

          // Optimistic update: add Important tag locally
          setNotes((prev) =>
            prev.map((n) =>
              n.id === id
                ? { ...n, tags: [...(n.tags ?? []), importantTag] }
                : n
            )
          );

          await addTagToNote(id, importantTag.id);
        } catch {
          // ignore failures, UI will reconcile on next fetch
        }
      }
    },
    [notes]
  );

  // Client-side search filter
  // Hide completely empty notes (no title + no content) so "opened and left" drafts
  // are not treated as real files in the UI.
  const nonEmptyNotes = notes.filter(
    (n) => (n.title?.trim() ?? '').length > 0 || (n.content?.trim() ?? '').length > 0
  );

  const baseList = nonEmptyNotes;

  const searchTerm = search.trim().toLowerCase();

  const filteredNotes = baseList.filter((n) => {
    const matchesSearch = !searchTerm
      ? true
      : n.title.toLowerCase().includes(searchTerm) ||
        n.content.toLowerCase().includes(searchTerm) ||
        (n.tags ?? []).some((t) => t.name.toLowerCase().includes(searchTerm));

    if (!matchesSearch) return false;

    if (filter === 'pinned') {
      return (n.tags ?? []).some((t) => t.name === 'Pinned');
    }
    if (filter === 'favorites') {
      return (n.tags ?? []).some((t) => t.name === 'Important');
    }
    return true; // 'all'
  });

  const selectedNote =
    notes.find((n) => n.id === selectedNoteId) ?? null;

  return {
    notes,
    isLoading,
    error,
    saveStatus,
    selectedNote,
    selectNote,
    createNote: handleCreateNote,
    updateNote: handleUpdateNote,
    moveNote: handleMoveNote,
    copyNote: handleCopyNote,
    deleteNote: handleDeleteNote,
    hardDeleteNote: handleHardDeleteNote,
    loadMore,
    hasMore,
    search,
    setSearch,
    filteredNotes,
    filter,
    setFilter,
    updateNoteTags,
    toggleFavorite,
  };
}
