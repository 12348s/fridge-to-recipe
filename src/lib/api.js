const REQUEST_TIMEOUT_MS = 30000;

/**
 * Calls our backend proxy, which holds the API key and talks to the LLM.
 * Accepts an AbortSignal so the caller (App.jsx) can cancel a stale
 * in-flight request when the user submits again.
 */
export async function fetchRecipe(prompt, signal) {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);

  // Combine the caller's abort signal with our own timeout.
  const onCallerAbort = () => timeoutController.abort();
  signal?.addEventListener('abort', onCallerAbort);

  try {
    const res = await fetch('/api/recipe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
      signal: timeoutController.signal,
    });

    const contentType = res.headers.get('content-type') || '';
    const body = contentType.includes('application/json') ? await res.json() : await res.text();

    if (!res.ok) {
      const message =
        (body && typeof body === 'object' && body.error) ||
        `Server responded with ${res.status}.`;
      throw new ApiError(message, res.status);
    }

    if (typeof body === 'object' && typeof body.raw === 'string') {
      return body.raw;
    }

    // Backend already returned parsed JSON — stringify so the client-side
    // parser has one single code path to go through.
    return typeof body === 'string' ? body : JSON.stringify(body);
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new ApiError(
        signal?.aborted ? 'Cancelled.' : 'The request took too long and timed out.',
        0,
        signal?.aborted ? 'cancelled' : 'timeout'
      );
    }
    if (err instanceof ApiError) throw err;
    throw new ApiError('Could not reach the server. Check your connection.', 0, 'network');
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onCallerAbort);
  }
}

export class ApiError extends Error {
  constructor(message, status, kind = 'server') {
    super(message);
    this.status = status;
    this.kind = kind;
  }
}
