import { useCallback, useRef, useState } from 'react';
import { fetchRecipe } from './lib/api';
import { parseRecipeResponse } from './lib/recipeSchema';
import RecipeCard from './components/RecipeCard';
import EmptyState from './components/EmptyState';

const EXAMPLE_PLACEHOLDER =
  "e.g. \"eggs, spinach, feta, half an onion, some stale bread\" or \"chicken thighs, coconut milk, curry paste, rice\"";

export default function App() {
  const [ingredients, setIngredients] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | error | success
  const [error, setError] = useState(null);
  const [recipe, setRecipe] = useState(null);

  // Guards against a slow, stale request overwriting a newer result:
  // each submit gets an id; only the response matching the *latest* id
  // is allowed to update state.
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef(null);

  const runRequest = useCallback(async (prompt) => {
    const thisRequestId = ++requestIdRef.current;

    // Cancel any in-flight request before starting a new one.
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setStatus('loading');
    setError(null);

    try {
      const rawText = await fetchRecipe(prompt, controller.signal);

      if (requestIdRef.current !== thisRequestId) return; // stale, ignore

      const result = parseRecipeResponse(rawText);
      if (!result.ok) {
        setStatus('error');
        setError({
          title: result.message,
          detail: result.detail,
          retriable: true,
        });
        return;
      }

      setRecipe(result.data);
      setStatus('success');
    } catch (err) {
      if (requestIdRef.current !== thisRequestId) return; // stale, ignore
      if (err.kind === 'cancelled') return; // superseded by a newer request

      setStatus('error');
      setError({
        title:
          err.kind === 'timeout'
            ? 'The request timed out.'
            : err.kind === 'network'
            ? 'Could not reach the server.'
            : 'The model call failed.',
        detail: err.message,
        retriable: true,
      });
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = ingredients.trim();
    if (!trimmed || status === 'loading') return;
    runRequest(trimmed);
  };

  const handleRetry = () => {
    if (ingredients.trim()) runRequest(ingredients.trim());
  };

  const handleReset = () => {
    requestIdRef.current++; // invalidate any in-flight request
    abortControllerRef.current?.abort();
    setStatus('idle');
    setError(null);
    setRecipe(null);
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <p className="eyebrow">Fridge → Recipe</p>
        <h1>What's in your fridge?</h1>
        <p>
          List what you've got, however messy. The AI turns it into a recipe with
          checkable steps and servings you can scale.
        </p>
      </header>

      <form className="notepad" onSubmit={handleSubmit}>
        <textarea
          value={ingredients}
          onChange={(e) => setIngredients(e.target.value)}
          placeholder={EXAMPLE_PLACEHOLDER}
          disabled={status === 'loading'}
        />
        <div className="notepad-footer">
          <span className="hint">Free-form is fine — no need for a list format.</span>
          <button
            type="submit"
            className="btn-primary"
            disabled={status === 'loading' || !ingredients.trim()}
          >
            {status === 'loading' ? 'Cooking…' : 'Get a recipe'}
          </button>
        </div>
      </form>

      {status === 'loading' && (
        <div className="status-block loading" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          Asking the model what to make with that…
        </div>
      )}

      {status === 'error' && error && (
        <div className="status-block error" role="alert">
          <strong>{error.title}</strong>
          {error.detail && <div>{error.detail}</div>}
          {error.retriable && (
            <div style={{ marginTop: 10 }}>
              <button type="button" className="btn-secondary" onClick={handleRetry}>
                Try again
              </button>
            </div>
          )}
        </div>
      )}

      {status === 'success' && recipe && (
        <RecipeCard recipe={recipe} onReset={handleReset} />
      )}

      {status === 'idle' && !recipe && (
        <EmptyState />
      )}
    </div>
  );
}
