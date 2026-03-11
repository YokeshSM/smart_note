import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { summarizeNote } from '../summarizer';

describe('summarizer', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false } as Response)));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns empty string for empty title and content', async () => {
    expect(await summarizeNote('', '')).toBe('');
    expect(await summarizeNote('  ', '  ')).toBe('');
  });

  it('returns first sentence when fallback is used', async () => {
    const result = await summarizeNote('', 'First sentence. Second sentence.');
    expect(result).toBe('First sentence.');
  });

  it('returns full text when single sentence under 160 chars', async () => {
    const text = 'A single short note.';
    expect(await summarizeNote('', text)).toBe(text);
  });

  it('truncates long single sentence with ellipsis', async () => {
    const long = 'a'.repeat(200);
    const result = await summarizeNote('', long);
    expect(result.length).toBe(160);
    expect(result.endsWith('…')).toBe(true);
  });

  it('uses title when content is empty', async () => {
    const result = await summarizeNote('My Title', '');
    expect(result).toBe('My Title');
  });

  it('prefers content for fallback when both title and content exist', async () => {
    const result = await summarizeNote('Title', 'Content sentence.');
    expect(result).toBe('Content sentence.');
  });
});
