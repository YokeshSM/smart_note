import React from 'react';
import { Plus } from 'lucide-react';
import { SearchBar } from '../ui/SearchBar';

interface HeaderProps {
  title?: string;
  noteCount?: number;
  search: string;
  onSearchChange: (q: string) => void;
  onNewNote: () => void;
}

/**
 * Header for the note list panel (middle column).
 * Contains: title, note count badge, search bar, new-note button.
 */
export const Header: React.FC<HeaderProps> = ({
  title = 'Notes',
  noteCount,
  search,
  onSearchChange,
  onNewNote,
}) => {
  return (
    <div className="flex-shrink-0 px-4 pt-5 pb-3 space-y-3">
      {/* Title row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold text-gray-900 dark:text-gray-50">
            {title}
          </h1>
          {noteCount !== undefined && noteCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
              {noteCount}
            </span>
          )}
        </div>

        {/* New note button */}
        <button
          onClick={onNewNote}
          title="New note (N)"
          className="
            flex items-center justify-center h-7 w-7 rounded-lg
            bg-indigo-600 hover:bg-indigo-700
            text-white
            shadow-sm shadow-indigo-500/30
            transition-all duration-150 active:scale-95
            focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1
            dark:focus:ring-offset-gray-900
          "
        >
          <Plus size={15} />
        </button>
      </div>

      {/* Search bar */}
      <SearchBar
        value={search}
        onChange={onSearchChange}
        placeholder="Search notes..."
      />
    </div>
  );
};
