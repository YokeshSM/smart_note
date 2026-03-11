import React, { useState } from 'react';
import { FileText, FolderOpen, Folder, Plus, Moon, Sun, LogOut, LogIn, PenLine, Trash2, ChevronRight, Calendar } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Avatar } from '../ui/Avatar';
import type { Folder as FolderType } from '../../types';
import { useLocation, useNavigate } from 'react-router-dom';

interface SidebarProps {
  folders: FolderType[];
  selectedFolderId: string | null;
  onSelectFolder: (id: string | null) => void;
  onCreateFolder: (name: string) => Promise<void>;
  onDeleteFolder: (id: string) => Promise<void>;
  onNewNote: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onDeleteFolder,
  onNewNote,
}) => {
  const { user, logout, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [foldersOpen, setFoldersOpen] = useState(true);

  const handleCreateSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = newFolderName.trim();
    if (!name) return;
    await onCreateFolder(name);
    setNewFolderName('');
    setIsCreating(false);
  };

  return (
    <aside className="flex-shrink-0 w-56 flex flex-col h-screen bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
      {/* Logo + app name */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-gray-200 dark:border-gray-800">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-500 flex items-center justify-center shadow-md shadow-indigo-500/25 flex-shrink-0">
          <PenLine size={15} className="text-white" />
        </div>
        <span className="text-sm font-bold text-gray-900 dark:text-gray-50 truncate">Smart Notes</span>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {/* New note button */}
        <button
          onClick={onNewNote}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-500/25 transition-all duration-150 active:scale-95 mb-3"
        >
          <Plus size={16} />
          New note
        </button>

        {/* All notes */}
        <NavItem
          icon={<FileText size={16} />}
          label="All Notes"
          active={location.pathname.startsWith('/notes') && selectedFolderId === null}
          onClick={() => {
            navigate('/notes', { replace: false })
            onSelectFolder(null)
          }}
        />

        <NavItem
          icon={<Calendar size={16} />}
          label="Calendar"
          active={location.pathname.startsWith('/calendar')}
          onClick={() => navigate('/calendar')}
        />

        <NavItem
          icon={<Trash2 size={16} />}
          label="Recently Deleted"
          active={location.pathname.startsWith('/trash')}
          onClick={() => navigate('/trash')}
        />

        {/* Folders section */}
        <div className="pt-3">
          <button
            onClick={() => setFoldersOpen((o) => !o)}
            className="w-full flex items-center justify-between px-3 py-1 text-xs font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-wider hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
          >
            <span>Folders</span>
            <ChevronRight size={13} className={`transition-transform duration-200 ${foldersOpen ? 'rotate-90' : ''}`} />
          </button>

          {foldersOpen && (
            <div className="mt-1 space-y-0.5">
              {folders.map((folder) => (
                <FolderItem
                  key={folder.id}
                  folder={folder}
                  active={location.pathname.startsWith('/notes') && selectedFolderId === folder.id}
                  onSelect={() => {
                    navigate(`/notes?folder=${encodeURIComponent(folder.id)}`)
                    onSelectFolder(folder.id)
                  }}
                  onDelete={() => onDeleteFolder(folder.id)}
                />
              ))}

              {isCreating ? (
                <form onSubmit={handleCreateSubmit} className="px-2 pt-1">
                  <input
                    autoFocus
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onBlur={() => { setIsCreating(false); setNewFolderName(''); }}
                    placeholder="Folder name…"
                    className="w-full px-2 py-1.5 text-xs rounded-lg border border-indigo-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </form>
              ) : (
                isAuthenticated && (
                  <button
                    onClick={() => setIsCreating(true)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs text-gray-400 dark:text-gray-600 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-all"
                  >
                    <Plus size={13} />
                    New folder
                  </button>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="px-2 py-3 border-t border-gray-200 dark:border-gray-800 space-y-0.5">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-800 transition-all"
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          {theme === 'light' ? 'Dark mode' : 'Light mode'}
        </button>

        {isAuthenticated && (
          <button
            onClick={async () => {
              await logout();
              navigate('/login', { replace: true });
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all"
          >
            <LogOut size={16} />
            Sign out
          </button>
        )}

        {!isAuthenticated && (
          <button
            onClick={() => { navigate('/login'); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-all"
          >
            <LogIn size={16} />
            Sign in
          </button>
        )}

        {user && (
          <div className="flex items-center gap-2.5 px-3 py-2 mt-1">
            <Avatar src={user.avatarUrl} name={user.name} size="sm" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{user.name}</p>
              <p className="text-xs text-gray-400 dark:text-gray-600 truncate">{user.email}</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

// ---------------------------------------------------------------------------
// NavItem
// ---------------------------------------------------------------------------
const NavItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}> = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
      active
        ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
    }`}
  >
    {icon}
    {label}
  </button>
);

// ---------------------------------------------------------------------------
// FolderItem
// ---------------------------------------------------------------------------
const FolderItem: React.FC<{
  folder: FolderType;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}> = ({ folder, active, onSelect, onDelete }) => {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      className={`group w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm cursor-pointer transition-all duration-150 ${
        active
          ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
      }`}
    >
      {active
        ? <FolderOpen size={16} style={{ color: folder.color }} />
        : <Folder size={16} style={{ color: folder.color }} />
      }
      <span className="flex-1 truncate text-sm">{folder.name}</span>
      <button
        onClick={handleDelete}
        title="Delete folder"
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-400 hover:text-red-500 transition-all"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
};
