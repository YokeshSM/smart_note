import React, { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AppLayout } from '../components/layout/AppLayout'
import { Header } from '../components/layout/Header'
import { NoteCard } from '../components/notes/NoteCard'
import { NoteEditor } from '../components/notes/NoteEditor'
import { useNotes } from '../hooks/useNotes'
import { useFolders } from '../hooks/useFolders'
import { useAuth } from '../hooks/useAuth'

export const NotesPage: React.FC = () => {
  const { isAuthenticated } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedFolderId = searchParams.get('folder')
  const setSelectedFolderId = (id: string | null) => {
    if (!id) {
      searchParams.delete('folder')
      setSearchParams(searchParams, { replace: true })
      return
    }
    searchParams.set('folder', id)
    setSearchParams(searchParams, { replace: true })
  }

  const { folders, createFolder, deleteFolder } = useFolders(isAuthenticated)
  const {
    filteredNotes,
    isLoading,
    saveStatus,
    selectedNote,
    selectNote,
    createNote,
    updateNote,
    moveNote,
    copyNote,
    deleteNote,
    loadMore,
    hasMore,
    search,
    setSearch,
    updateNoteTags,
    toggleFavorite,
  } = useNotes(isAuthenticated, selectedFolderId ?? undefined)

  const noteIdFromUrl = searchParams.get('note')
  useEffect(() => {
    if (noteIdFromUrl && !isLoading && filteredNotes.some((n) => n.id === noteIdFromUrl)) {
      selectNote(noteIdFromUrl)
    }
  }, [noteIdFromUrl, isLoading, filteredNotes, selectNote])

  const handleNewNote = () => {
    if (!isAuthenticated) {
      window.location.href = '/login'
      return
    }
    createNote('', '')
  }

  return (
    <AppLayout
      selectedNote={selectedNote}
      saveStatus={saveStatus}
      search={search}
      onSearchChange={setSearch}
      onNewNote={handleNewNote}
      noteCount={filteredNotes.length}
      folders={folders}
        selectedFolderId={selectedFolderId}
      onSelectFolder={setSelectedFolderId}
      onCreateFolder={createFolder}
      onDeleteFolder={deleteFolder}
    >
      {/* Middle: note list */}
      <div className="flex flex-col h-full">
        <Header
          title={selectedFolderId
            ? (folders.find(f => f.id === selectedFolderId)?.name ?? 'Folder')
            : 'All Notes'}
          noteCount={filteredNotes.length}
          search={search}
          onSearchChange={setSearch}
          onNewNote={handleNewNote}
        />
        <div className="flex-1 overflow-y-auto scrollbar-thin px-3 pb-4 space-y-1">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center px-4">
              <p className="text-sm text-gray-400 dark:text-gray-600">No notes yet.</p>
              <button
                onClick={handleNewNote}
                className="mt-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Create one
              </button>
            </div>
          ) : (
            <>
              {filteredNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  isSelected={selectedNote?.id === note.id}
                  folders={folders}
                  showFolderSubtitle={selectedFolderId === null}
                  onSelect={selectNote}
                  onMove={moveNote}
                  onCopy={copyNote}
                  onDelete={deleteNote}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
              {hasMore && (
                <button
                  onClick={loadMore}
                  className="w-full py-2 text-xs text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Load more
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right: editor */}
      <NoteEditor
        note={selectedNote}
        saveStatus={saveStatus}
        isAuthenticated={isAuthenticated}
        folders={folders}
        onUpdate={updateNote}
        onCreate={createNote}
        onMove={moveNote}
        onCopy={copyNote}
        onDelete={deleteNote}
        onTagsChange={updateNoteTags}
      />
    </AppLayout>
  )
}
