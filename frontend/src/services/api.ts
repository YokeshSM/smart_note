import { supabase } from '../lib/supabase'
import type { Folder, Note, PaginatedNotes, Tag, User } from '../types'

// ── Mappers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toNote(row: any): Note {
  const noteTags =
    Array.isArray(row.note_tags) && row.note_tags.length > 0
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (row.note_tags as any[])
          .map((nt) => (nt.tags ? toTag(nt.tags) : null))
          .filter((t): t is Tag => !!t)
      : undefined

  return {
    id: row.id,
    userId: row.user_id,
    folderId: row.folder_id ?? null,
    title: row.title ?? '',
    content: row.content ?? '',
    isPinned: row.is_pinned ?? false,
    deletedAt: row.deleted_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags: noteTags,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toFolder(row: any): Folder {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    color: row.color ?? '#6366f1',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    noteCount: row.note_count ?? undefined,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toTag(row: any): Tag {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    color: row.color ?? '#6366f1',
    createdAt: row.created_at,
    usageCount: row.usage_count ?? undefined,
  }
}

// ── Notes ─────────────────────────────────────────────────────────────────────

export async function getNotes(page = 1, limit = 50, folderId?: string | null): Promise<PaginatedNotes> {
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase
    .from('notes')
    .select('*, note_tags:note_tags(tags:tags(*))', { count: 'exact' })
    .is('deleted_at', null)
    .order('is_pinned', { ascending: false })
    .order('updated_at', { ascending: false })
    .range(from, to)

  if (folderId !== undefined) {
    query = folderId ? query.eq('folder_id', folderId) : query.is('folder_id', null)
  }

  const { data, error, count } = await query
  if (error) throw new Error(error.message)

  const notes = (data ?? []).map(toNote)
  const total = count ?? 0
  return { data: notes, total, page, limit, hasMore: from + notes.length < total }
}

export async function getTrashedNotes(): Promise<Note[]> {
  const { data, error } = await supabase
    .from('notes')
    .select('*, note_tags:note_tags(tags:tags(*))')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map(toNote)
}

export async function searchNotes(term: string): Promise<Note[]> {
  const { data, error } = await supabase
    .from('notes')
    .select('*, note_tags:note_tags(tags:tags(*))')
    .is('deleted_at', null)
    .or(`title.ilike.%${term}%,content.ilike.%${term}%`)
    .order('updated_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map(toNote)
}

export async function getNote(id: string): Promise<Note> {
  const { data, error } = await supabase
    .from('notes')
    .select('*, note_tags:note_tags(tags:tags(*))')
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)
  return toNote(data)
}

export async function createNote(title: string, content: string, folderId?: string | null): Promise<Note> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('notes')
    .insert({ title: title || 'Untitled Note', content, user_id: user.id, folder_id: folderId ?? null })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return toNote(data)
}

export async function updateNote(
  id: string,
  partial: Partial<Pick<Note, 'title' | 'content' | 'isPinned' | 'folderId'>>
): Promise<Note> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: Record<string, any> = {}
  if (partial.title !== undefined) patch.title = partial.title
  if (partial.content !== undefined) patch.content = partial.content
  if (partial.isPinned !== undefined) patch.is_pinned = partial.isPinned
  if (partial.folderId !== undefined) patch.folder_id = partial.folderId

  const { data, error } = await supabase
    .from('notes')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return toNote(data)
}

export async function trashNote(id: string): Promise<void> {
  const { error } = await supabase
    .from('notes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function restoreNote(id: string): Promise<void> {
  const { error } = await supabase
    .from('notes')
    .update({ deleted_at: null })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteNote(id: string): Promise<void> {
  const { error } = await supabase.from('notes').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** Duplicate a note (same title + content). Optionally into a different folder. */
export async function copyNote(
  noteId: string,
  targetFolderId?: string | null
): Promise<Note> {
  const note = await getNote(noteId)
  return createNote(note.title, note.content, targetFolderId ?? note.folderId)
}

export async function emptyTrash(): Promise<void> {
  const { error } = await supabase
    .from('notes')
    .delete()
    .not('deleted_at', 'is', null)
  if (error) throw new Error(error.message)
}

// ── Folders ───────────────────────────────────────────────────────────────────

export async function getFolders(): Promise<Folder[]> {
  const { data, error } = await supabase
    .from('folders')
    .select('*, note_count:notes(count)')
    .order('name')

  if (error) throw new Error(error.message)
  return (data ?? []).map(toFolder)
}

export async function createFolder(name: string, color = '#6366f1'): Promise<Folder> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('folders')
    .insert({ name, color, user_id: user.id })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return toFolder(data)
}

export async function updateFolder(id: string, partial: Partial<Pick<Folder, 'name' | 'color'>>): Promise<Folder> {
  const { data, error } = await supabase
    .from('folders')
    .update(partial)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return toFolder(data)
}

export async function deleteFolder(id: string): Promise<void> {
  const { error } = await supabase.from('folders').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ── Tags ──────────────────────────────────────────────────────────────────────

const SYSTEM_TAG_DEFS = [
  { name: 'Pinned', color: '#fbbf24' },
  { name: 'Important', color: '#f87171' },
  { name: 'Todo', color: '#34d399' },
] as const

export async function getTags(): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .order('name')

  if (error) throw new Error(error.message)
  return (data ?? []).map(toTag)
}

export async function createTag(name: string, color = '#6366f1'): Promise<Tag> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('tags')
    .insert({ name, color, user_id: user.id })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return toTag(data)
}

export async function ensureSystemTags(): Promise<Tag[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const names = SYSTEM_TAG_DEFS.map((t) => t.name)

  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('user_id', user.id)
    .in('name', names)

  if (error) throw new Error(error.message)

  const existingByName = new Map<string, Tag>()
  ;(data ?? []).forEach((row) => {
    existingByName.set(row.name, toTag(row))
  })

  const toCreate = SYSTEM_TAG_DEFS.filter((def) => !existingByName.has(def.name))

  if (toCreate.length > 0) {
    const { data: created, error: insertError } = await supabase
      .from('tags')
      .insert(
        toCreate.map((def) => ({
          name: def.name,
          color: def.color,
          user_id: user.id,
        })),
      )
      .select('*')

    if (insertError) throw new Error(insertError.message)
    ;(created ?? []).forEach((row) => {
      existingByName.set(row.name, toTag(row))
    })
  }

  return names
    .map((n) => existingByName.get(n))
    .filter((t): t is Tag => !!t)
}

export async function getTagsForNote(noteId: string): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('note_tags')
    .select('tags:tags(*)')
    .eq('note_id', noteId)

  if (error) throw new Error(error.message)
  return (data ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((row: any) => (row.tags ? toTag(row.tags) : null))
    .filter((t): t is Tag => !!t)
}

export async function addTagToNote(noteId: string, tagId: string): Promise<void> {
  const { error } = await supabase
    .from('note_tags')
    .insert({ note_id: noteId, tag_id: tagId })
  if (error && error.code !== '23505') throw new Error(error.message) // ignore duplicate
}

export async function removeTagFromNote(noteId: string, tagId: string): Promise<void> {
  const { error } = await supabase
    .from('note_tags')
    .delete()
    .eq('note_id', noteId)
    .eq('tag_id', tagId)
  if (error) throw new Error(error.message)
}

// ── User ──────────────────────────────────────────────────────────────────────

export async function getMe(): Promise<User> {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Not authenticated')
  return {
    id: user.id,
    email: user.email ?? '',
    name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? 'User',
    avatarUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
  }
}
