const FALLBACK_MAX_CHARS = 160;

/**
 * Summarize a note using an external AI endpoint when configured,
 * with a simple in-browser fallback when not.
 *
 * ApyHub integration:
 * - Set VITE_SUMMARIZER_API_URL to "https://api.apyhub.com/ai/summarize-text"
 *   or "https://api.apyhub.com/ai/summarize-url" (if you prefer URL-based summarization).
 * - Set VITE_APYHUB_TOKEN to your ApyHub token; it will be sent as the "apy-token" header.
 */
export async function summarizeNote(title: string, content: string): Promise<string> {
  const normalizedTitle = (title ?? '').trim();
  const normalizedContent = (content ?? '').trim();
  const text = normalizedContent || normalizedTitle;

  if (!text) return '';

  const endpoint = import.meta.env.VITE_SUMMARIZER_API_URL;
  const apyToken = import.meta.env.VITE_APYHUB_TOKEN;

  if (endpoint) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (apyToken) {
        headers['apy-token'] = apyToken;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          // ApyHub summarize-text expects a single "text" field plus options
          text,
          summary_length: 'short',
          output_language: 'en',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const summary =
          typeof data.summary === 'string'
            ? data.summary
            : typeof data.data?.summary === 'string'
              ? data.data.summary
              : '';

        if (summary.trim().length > 0) return summary.trim();
      }
    } catch {
      // fall through to local heuristic summary
    }
  }

  // Simple heuristic summary if no AI endpoint is configured or it fails.
  const firstSentenceMatch = text.match(/[^.!?]+[.!?]/);
  const candidate = (firstSentenceMatch?.[0] ?? text).trim();

  if (candidate.length <= FALLBACK_MAX_CHARS) {
    return candidate;
  }

  return `${candidate.slice(0, FALLBACK_MAX_CHARS - 1).trimEnd()}…`;
}

