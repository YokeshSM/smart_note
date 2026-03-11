import type { Note } from '../types';

export interface CalendarEvent {
  date: Date;
  dateKey: string; // YYYY-MM-DD for grouping
  noteId: string;
  noteTitle: string;
  snippet: string;
  status: 'pinned' | 'important' | 'todo' | 'default';
}

const MONTH_NAMES =
  'january|february|march|april|may|june|july|august|september|october|november|december';
const MONTH_SHORT = 'jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec';

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getStatus(note: Note): CalendarEvent['status'] {
  const names = new Set((note.tags ?? []).map((t) => t.name));
  if (names.has('Pinned')) return 'pinned';
  if (names.has('Important')) return 'important';
  if (names.has('Todo')) return 'todo';
  return 'default';
}

/**
 * Parse a string for date mentions and return an array of CalendarEvent candidates.
 * Supports ISO (2025-03-15), US (3/15/2025), EU (15.03.2025), month names (March 15), and today/tomorrow.
 */
function extractDatesFromText(
  text: string,
  noteId: string,
  noteTitle: string,
  status: CalendarEvent['status']
): CalendarEvent[] {
  if (!text || !text.trim()) return [];
  const events: CalendarEvent[] = [];
  const seen = new Set<string>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const add = (d: Date, snippet: string) => {
    const key = toDateKey(d);
    if (seen.has(key)) return;
    seen.add(key);
    events.push({
      date: new Date(d),
      dateKey: key,
      noteId,
      noteTitle: noteTitle || 'Untitled',
      snippet: snippet.slice(0, 80).trim(),
      status,
    });
  };

  // ISO: 2025-03-15, 2025-03-15T10:00
  const iso = /(\d{4})-(\d{2})-(\d{2})(?:T|\s|$)/g;
  let m: RegExpExecArray | null;
  while ((m = iso.exec(text)) !== null) {
    const d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
    if (!isNaN(d.getTime())) add(d, m[0]);
  }

  // US: 3/15/2025, 03/15/25
  const us = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/g;
  while ((m = us.exec(text)) !== null) {
    const y = parseInt(m[3], 10);
    const year = y < 100 ? 2000 + y : y;
    const d = new Date(year, parseInt(m[1], 10) - 1, parseInt(m[2], 10));
    if (!isNaN(d.getTime())) add(d, m[0]);
  }

  // EU: 15.03.2025, 15/03/2025
  const eu = /(\d{1,2})[./](\d{1,2})[./](\d{2,4})\b/g;
  while ((m = eu.exec(text)) !== null) {
    const y = parseInt(m[3], 10);
    const year = y < 100 ? 2000 + y : y;
    const d = new Date(year, parseInt(m[2], 10) - 1, parseInt(m[1], 10));
    if (!isNaN(d.getTime())) add(d, m[0]);
  }

  // Month name: March 15, 15 March, Mar 15, 15 Mar 2025
  const monthRegex = new RegExp(
    `\\b(${MONTH_NAMES}|${MONTH_SHORT})\\.?\\s+(\\d{1,2})(?:\\s+(\\d{4}))?\\b`,
    'gi'
  );
  const monthRegex2 = new RegExp(
    `\\b(\\d{1,2})\\s+(${MONTH_NAMES}|${MONTH_SHORT})\\.?(?:\\s+(\\d{4}))?\\b`,
    'gi'
  );
  const monthIndex: Record<string, number> = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
    jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  while ((m = monthRegex.exec(text)) !== null) {
    const monthStr = m[1].toLowerCase();
    const month = monthIndex[monthStr];
    if (month === undefined) continue;
    const day = parseInt(m[2], 10);
    const year = m[3] ? parseInt(m[3], 10) : today.getFullYear();
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) add(d, m[0]);
  }
  while ((m = monthRegex2.exec(text)) !== null) {
    const day = parseInt(m[1], 10);
    const monthStr = m[2].toLowerCase();
    const month = monthIndex[monthStr];
    if (month === undefined) continue;
    const year = m[3] ? parseInt(m[3], 10) : today.getFullYear();
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) add(d, m[0]);
  }

  // today, tomorrow
  const lower = text.toLowerCase();
  if (/\btoday\b/.test(lower)) add(new Date(today), 'today');
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (/\btomorrow\b/.test(lower)) add(tomorrow, 'tomorrow');

  return events;
}

/**
 * Extract all calendar events from a note (title + content).
 */
export function extractEventsFromNote(note: Note): CalendarEvent[] {
  const status = getStatus(note);
  const combined = [note.title, note.content].filter(Boolean).join('\n');
  return extractDatesFromText(combined, note.id, note.title, status);
}
