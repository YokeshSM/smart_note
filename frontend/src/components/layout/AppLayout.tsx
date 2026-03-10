import React from 'react';
import { Sidebar } from './Sidebar';
import type { Note, SaveStatus, Folder } from '../../types';

interface AppLayoutProps {
  children: React.ReactNode;
  selectedNote: Note | null;
  saveStatus: SaveStatus;
  search: string;
  onSearchChange: (q: string) => void;
  onNewNote: () => void;
  noteCount: number;
  folders: Folder[];
  selectedFolderId: string | null;
  onSelectFolder: (id: string | null) => void;
  onCreateFolder: (name: string) => Promise<void>;
  onDeleteFolder: (id: string) => Promise<void>;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  selectedNote,
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onDeleteFolder,
  onNewNote,
}) => {
  const childArray = React.Children.toArray(children);
  const listPanel = childArray[0];
  const editorPanel = childArray[1];

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-gray-950">
      <Sidebar
        folders={folders}
        selectedFolderId={selectedFolderId}
        onSelectFolder={onSelectFolder}
        onCreateFolder={onCreateFolder}
        onDeleteFolder={onDeleteFolder}
        onNewNote={onNewNote}
      />

      <div
        className={`
          flex-shrink-0 w-72 flex flex-col
          border-r border-gray-200 dark:border-gray-800
          bg-gray-50 dark:bg-gray-900
          overflow-hidden
          ${selectedNote ? 'hidden md:flex' : 'flex'}
        `}
      >
        {listPanel}
      </div>

      <div
        className={`
          flex-1 flex flex-col min-w-0 overflow-hidden
          bg-white dark:bg-gray-950
          ${!selectedNote ? 'hidden md:flex' : 'flex'}
        `}
      >
        {editorPanel}
      </div>
    </div>
  );
};
