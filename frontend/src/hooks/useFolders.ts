import { useCallback, useEffect, useState } from 'react'
import type { Folder } from '../types'
import { getFolders, createFolder, deleteFolder } from '../services/api'

interface UseFoldersReturn {
  folders: Folder[]
  isLoading: boolean
  createFolder: (name: string, color?: string) => Promise<void>
  deleteFolder: (id: string) => Promise<void>
}

export function useFolders(isAuthenticated: boolean): UseFoldersReturn {
  const [folders, setFolders] = useState<Folder[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFolders([])
      return
    }
    setIsLoading(true)
    getFolders()
      .then(setFolders)
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [isAuthenticated])

  const handleCreate = useCallback(async (name: string, color?: string) => {
    const folder = await createFolder(name, color)
    setFolders((prev) => [...prev, folder])
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    await deleteFolder(id)
    setFolders((prev) => prev.filter((f) => f.id !== id))
  }, [])

  return { folders, isLoading, createFolder: handleCreate, deleteFolder: handleDelete }
}
