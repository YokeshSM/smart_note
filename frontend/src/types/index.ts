export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export interface Folder {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
  noteCount?: number;
}

export interface Tag {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: string;
  usageCount?: number;
}

export interface Note {
  id: string;
  userId: string;
  folderId: string | null;
  title: string;
  content: string;
  isPinned: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  tags?: Tag[];
}

export interface PaginatedNotes {
  data: Note[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export type Theme = 'light' | 'dark';
