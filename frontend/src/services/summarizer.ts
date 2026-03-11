const FALLBACK_MAX_CHARS = 160;

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Summarize a note using Groq API when configured,
 * with a simple in-browser fallback when not.
 *
 * Groq integration:
 * - Set VITE_GROQ_API_KEY to your Groq API key (from https://console.groq.com).
 *   It is sent as Bearer token to Groq's chat completions endpoint.
 * - If unset or the request fails, a short heuristic summary is returned.
 */
export async function summarizeNote(title: string, content: string): Promise<string> {
  const normalizedTitle = (title ?? '').trim();
  const normalizedContent = (content ?? '').trim();
  const text = normalizedContent || normalizedTitle;

  if (!text) return '';

  const groqApiKey = import.meta.env.VITE_GROQ_API_KEY;

  if (groqApiKey) {
    try {
      const prompt = [
        normalizedTitle ? `Title: ${normalizedTitle}` : null,
        normalizedContent || null,
      ]
        .filter(Boolean)
        .join('\n\n');

      const res = await fetch(GROQ_CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${groqApiKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content:
                'You summarize notes briefly and clearly. Reply with only the summary: 1–2 short sentences, max 50 words. No headings, bullets, or extra commentary.',
            },
            { role: 'user', content: `Summarize this note:\n\n${prompt}` },
          ],
          max_tokens: 150,
          temperature: 0.3,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const summary = data.choices?.[0]?.message?.content?.trim?.();
        if (summary && summary.length > 0) return summary;
      }
    } catch {
      // fall through to local heuristic summary
    }
  }

  // Simple heuristic summary if Groq is not configured or the request fails.
  const firstSentenceMatch = text.match(/[^.!?]+[.!?]/);
  const candidate = (firstSentenceMatch?.[0] ?? text).trim();

  if (candidate.length <= FALLBACK_MAX_CHARS) {
    return candidate;
  }

  return `${candidate.slice(0, FALLBACK_MAX_CHARS - 1).trimEnd()}…`;
}
