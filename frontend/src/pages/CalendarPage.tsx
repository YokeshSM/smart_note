import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { Sidebar } from '../components/layout/Sidebar';
import { useAuth } from '../hooks/useAuth';
import { useFolders } from '../hooks/useFolders';
import { getNotes } from '../services/api';
import type { Note } from '../types';
import { extractEventsFromNote, type CalendarEvent } from '../lib/dateFromNotes';

const STATUS_COLORS: Record<CalendarEvent['status'], string> = {
  pinned: 'bg-amber-400 dark:bg-amber-500',
  important: 'bg-red-400 dark:bg-red-500',
  todo: 'bg-emerald-400 dark:bg-emerald-500',
  default: 'bg-indigo-400 dark:bg-indigo-500',
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getMonthDays(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = first.getDay();
  const daysInMonth = last.getDate();
  const total = startPad + daysInMonth;
  const rows = Math.ceil(total / 7) * 7;
  const out: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) out.push(null);
  for (let d = 1; d <= daysInMonth; d++) out.push(new Date(year, month, d));
  while (out.length < rows) out.push(null);
  return out;
}

export const CalendarPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { folders, createFolder, deleteFolder } = useFolders(isAuthenticated);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  const loadNotes = useCallback(async () => {
    if (!isAuthenticated) {
      setEvents([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const all: Note[] = [];
      let page = 1;
      const limit = 100;
      let hasMore = true;
      while (hasMore) {
        const res = await getNotes(page, limit);
        all.push(...res.data);
        hasMore = res.hasMore && page * limit < res.total;
        page += 1;
        if (page > 5) break;
      }
      const extracted: CalendarEvent[] = [];
      all.forEach((note) => {
        extracted.push(...extractEventsFromNote(note));
      });
      setEvents(extracted);
    } catch {
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const handleNewNote = () => {
    if (!isAuthenticated) {
      window.location.href = '/login';
      return;
    }
    navigate('/notes');
  };

  const monthDays = getMonthDays(viewDate.year, viewDate.month);
  const eventsByDate = React.useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach((ev) => {
      const list = map.get(ev.dateKey) ?? [];
      list.push(ev);
      map.set(ev.dateKey, list);
    });
    return map;
  }, [events]);

  const selectedEvents = selectedDateKey ? eventsByDate.get(selectedDateKey) ?? [] : [];

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-gray-950">
      <Sidebar
        folders={folders}
        selectedFolderId={null}
        onSelectFolder={() => {}}
        onCreateFolder={createFolder}
        onDeleteFolder={deleteFolder}
        onNewNote={handleNewNote}
      />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col h-full w-full max-w-4xl mx-auto">
        <div className="flex-shrink-0 px-4 pt-5 pb-3 flex items-center justify-between">
          <h1 className="text-base font-semibold text-gray-900 dark:text-gray-50">Calendar</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Dates mentioned in your notes appear here
          </p>
        </div>

        <div className="flex-1 overflow-auto px-4 pb-6">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() =>
                setViewDate((prev) =>
                  prev.month === 0
                    ? { year: prev.year - 1, month: 11 }
                    : { year: prev.year, month: prev.month - 1 }
                )
              }
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-400"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              {MONTHS[viewDate.month]} {viewDate.year}
            </span>
            <button
              type="button"
              onClick={() =>
                setViewDate((prev) =>
                  prev.month === 11
                    ? { year: prev.year + 1, month: 0 }
                    : { year: prev.year, month: prev.month + 1 }
                )
              }
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-400"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {WEEKDAYS.map((d) => (
                  <div
                    key={d}
                    className="text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 py-1"
                  >
                    {d}
                  </div>
                ))}
              </div>
              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {monthDays.map((day, i) => {
                  if (!day) {
                    return <div key={`empty-${i}`} className="aspect-square" />;
                  }
                  const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                  const dayEvents = eventsByDate.get(key) ?? [];
                  const isSelected = selectedDateKey === key;
                  const isToday =
                    key ===
                    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedDateKey(isSelected ? null : key)}
                      className={`
                        aspect-square min-h-[48px] rounded-xl text-left p-1.5 border transition-colors
                        ${isSelected ? 'ring-2 ring-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800' : 'border-transparent hover:bg-gray-100 dark:hover:bg-gray-800/70'}
                        ${isToday ? 'border-indigo-300 dark:border-indigo-700' : ''}
                      `}
                    >
                      <span
                        className={`text-xs font-medium ${isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'}`}
                      >
                        {day.getDate()}
                      </span>
                      <div className="flex flex-wrap gap-0.5 mt-0.5">
                        {dayEvents.slice(0, 3).map((ev, j) => (
                          <span
                            key={`${ev.noteId}-${j}`}
                            className={`inline-block w-1.5 h-1.5 rounded-full ${STATUS_COLORS[ev.status]}`}
                            title={`${ev.noteTitle} – ${ev.snippet}`}
                          />
                        ))}
                        {dayEvents.length > 3 && (
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">
                            +{dayEvents.length - 3}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800 flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" /> Pinned
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-400" /> Important
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" /> Todo
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-400" /> Note
                </span>
              </div>

              {/* Selected day events */}
              {selectedDateKey && (
                <div className="mt-6 p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                  <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
                    {selectedDateKey} – {selectedEvents.length} note{selectedEvents.length !== 1 ? 's' : ''}
                  </h2>
                  {selectedEvents.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400">No notes mention this date.</p>
                  ) : (
                    <ul className="space-y-2">
                      {selectedEvents.map((ev) => (
                        <li key={`${ev.noteId}-${ev.snippet}`}>
                          <button
                            type="button"
                            onClick={() => navigate(`/notes?note=${ev.noteId}`)}
                            className="w-full flex items-start gap-2 text-left p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                          >
                            <span
                              className={`flex-shrink-0 w-2 h-2 rounded-full mt-1.5 ${STATUS_COLORS[ev.status]}`}
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                {ev.noteTitle}
                              </p>
                              {ev.snippet && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                  {ev.snippet}
                                </p>
                              )}
                            </div>
                            <FileText size={14} className="flex-shrink-0 text-gray-400" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  </div>
  );
};
