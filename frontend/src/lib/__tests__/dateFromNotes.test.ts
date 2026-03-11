import { describe, expect, it } from 'vitest';
import { extractEventsFromNote } from '../dateFromNotes';
import type { Note } from '../../types';

function mockNote(overrides: Partial<Note> & { title: string; content: string }): Note {
  return {
    id: 'note-1',
    userId: 'user-1',
    folderId: null,
    isPinned: false,
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: [],
    ...overrides,
    title: overrides.title,
    content: overrides.content,
  };
}

describe('dateFromNotes', () => {
  it('returns empty array for note with no dates', () => {
    const note = mockNote({ title: 'No dates', content: 'Just some text here.' });
    expect(extractEventsFromNote(note)).toEqual([]);
  });

  it('extracts ISO date 2025-03-15', () => {
    const note = mockNote({
      title: 'Meeting',
      content: 'We meet on 2025-03-15 to discuss.',
    });
    const events = extractEventsFromNote(note);
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events.some((e) => e.dateKey === '2025-03-15')).toBe(true);
    expect(events.find((e) => e.dateKey === '2025-03-15')?.noteTitle).toBe('Meeting');
  });

  it('extracts US format 3/15/2025', () => {
    const note = mockNote({ title: 'Deadline', content: 'Due 3/15/2025.' });
    const events = extractEventsFromNote(note);
    expect(events.some((e) => e.dateKey === '2025-03-15')).toBe(true);
  });

  it('extracts month name March 15', () => {
    const note = mockNote({ title: 'Event', content: 'See you March 15.' });
    const events = extractEventsFromNote(note);
    expect(events.some((e) => e.dateKey.endsWith('-03-15'))).toBe(true);
  });

  it('extracts "today" and "tomorrow"', () => {
    const note = mockNote({ title: 'Reminder', content: 'Do it today and tomorrow.' });
    const events = extractEventsFromNote(note);
    expect(events.length).toBeGreaterThanOrEqual(2);
    const keys = events.map((e) => e.dateKey);
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowKey = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    expect(keys).toContain(todayKey);
    expect(keys).toContain(tomorrowKey);
  });

  it('sets status to pinned when note has Pinned tag', () => {
    const note = mockNote({
      title: 'Pinned note',
      content: 'Meeting 2025-06-01',
      tags: [{ id: 't1', userId: 'u1', name: 'Pinned', color: '#fff', createdAt: '' }],
    });
    const events = extractEventsFromNote(note);
    expect(events.every((e) => e.status === 'pinned')).toBe(true);
  });

  it('sets status to important when note has Important tag', () => {
    const note = mockNote({
      title: 'Important',
      content: '2025-07-01 deadline',
      tags: [{ id: 't2', userId: 'u1', name: 'Important', color: '#f00', createdAt: '' }],
    });
    const events = extractEventsFromNote(note);
    expect(events.every((e) => e.status === 'important')).toBe(true);
  });

  it('sets status to default when note has no special tags', () => {
    const note = mockNote({ title: 'Normal', content: 'Date: 2025-08-10.' });
    const events = extractEventsFromNote(note);
    expect(events.every((e) => e.status === 'default')).toBe(true);
  });
});
