import React, { useEffect, useState } from 'react'
import { RotateCcw, Trash2 } from 'lucide-react'
import { AppLayout } from '../components/layout/AppLayout'
import { Header } from '../components/layout/Header'
import { useAuth } from '../hooks/useAuth'
import { useFolders } from '../hooks/useFolders'
import type { Note } from '../types'
import { deleteNote, emptyTrash, getTrashedNotes, restoreNote } from '../services/api'

export const TrashPage: React.FC = () => {
  const { isAuthenticated } = useAuth()
  const { folders, createFolder, deleteFolder } = useFolders(isAuthenticated)
  const [notes, setNotes] = useState<Note[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!isAuthenticated) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotes([])
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    getTrashedNotes()
      .then(setNotes)
      .catch(() => setNotes([]))
      .finally(() => setIsLoading(false))
  }, [isAuthenticated])

  const filtered = search.trim()
    ? notes.filter(
        (n) =>
          n.title.toLowerCase().includes(search.toLowerCase()) ||
          n.content.toLowerCase().includes(search.toLowerCase()),
      )
    : notes

  const handleRestore = async (id: string) => {
    await restoreNote(id)
    setNotes((prev) => prev.filter((n) => n.id !== id))
  }

  const handleDeleteForever = async (id: string) => {
    const ok = window.confirm('Delete forever? This cannot be undone.')
    if (!ok) return
    await deleteNote(id)
    setNotes((prev) => prev.filter((n) => n.id !== id))
  }

  const handleEmptyTrash = async () => {
    const ok = window.confirm('Empty trash? This will permanently delete all trashed notes.')
    if (!ok) return
    await emptyTrash()
    setNotes([])
  }

  return (
    <AppLayout
      selectedNote={null}
      saveStatus="idle"
      search={search}
      onSearchChange={setSearch}
      onNewNote={() => {
        window.location.href = '/notes'
      }}
      noteCount={filtered.length}
      folders={folders}
      selectedFolderId={null}
      onSelectFolder={(id) => {
        window.location.href = id ? `/notes?folder=${encodeURIComponent(id)}` : '/notes'
      }}
      onCreateFolder={createFolder}
      onDeleteFolder={deleteFolder}
    >
      <div className="flex flex-col h-full">
        <Header
          title="Recently Deleted"
          noteCount={filtered.length}
          search={search}
          onSearchChange={setSearch}
          onNewNote={() => {
            window.location.href = '/notes'
          }}
        />

        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={handleEmptyTrash}
            disabled={!isAuthenticated || notes.length === 0}
            className="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
          >
            Empty trash
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-3 pb-4 space-y-1">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center px-4">
              <p className="text-sm text-gray-400 dark:text-gray-600">Trash is empty.</p>
            </div>
          ) : (
            filtered.map((note) => (
              <div
                key={note.id}
                className="group w-full text-left px-3 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
              >
                <div className="flex items-start justify-between gap-2 min-w-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-50 truncate">
                      {note.title || 'Untitled Note'}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-600 line-clamp-2">
                      {note.content || 'No content'}
                    </p>
                    {note.deletedAt && (
                      <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-600">
                        Deleted {new Date(note.deletedAt).toLocaleString()}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleRestore(note.id)}
                      title="Restore"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-all"
                    >
                      <RotateCcw size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteForever(note.id)}
                      title="Delete forever"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right side intentionally empty on Trash */}
      <div className="hidden md:flex flex-1 items-center justify-center bg-white dark:bg-gray-950">
        <div className="text-center px-6">
          <p className="text-sm text-gray-400 dark:text-gray-600">
            Restore notes from the trash, or delete them forever.
          </p>
        </div>
      </div>
    </AppLayout>
  )
}

