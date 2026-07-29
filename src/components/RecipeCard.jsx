import { useMemo, useState } from 'react';
import { formatAmount } from '../lib/formatAmount';

export default function RecipeCard({ recipe, onReset }) {
  const [servings, setServings] = useState(recipe.baseServings);
  const [checkedSteps, setCheckedSteps] = useState(() => new Set());

  const scale = servings / recipe.baseServings;

  const scaledIngredients = useMemo(
    () =>
      recipe.ingredients.map((ing) => ({
        ...ing,
        scaledAmount: ing.amount * scale,
      })),
    [recipe.ingredients, scale]
  );

  const toggleStep = (index) => {
    setCheckedSteps((prev) => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };

  const doneCount = checkedSteps.size;
  const totalSteps = recipe.steps.length;
  const progressPct = totalSteps ? Math.round((doneCount / totalSteps) * 100) : 0;

  const adjustServings = (delta) => {
    setServings((s) => Math.max(1, Math.min(50, s + delta)));
  };

  return (
    <article className="recipe-card">
      <h2 className="recipe-title">{recipe.title}</h2>

      <div className="recipe-meta">
        <span className="servings-control">
          <button
            type="button"
            aria-label="Decrease servings"
            onClick={() => adjustServings(-1)}
          >
            −
          </button>
          {servings} serving{servings === 1 ? '' : 's'}
          <button
            type="button"
            aria-label="Increase servings"
            onClick={() => adjustServings(1)}
          >
            +
          </button>
        </span>
        {recipe.totalTimeMinutes && <span>~{recipe.totalTimeMinutes} min</span>}
      </div>

      {recipe.description && (
        <p style={{ margin: '0 0 4px', fontSize: 14.5, color: 'var(--ink-soft)' }}>
          {recipe.description}
        </p>
      )}

      <p className="section-label">Ingredients</p>
      <ul className="ingredient-list">
        {scaledIngredients.map((ing, i) => (
          <li className="ingredient-row" key={i}>
            <div>
              <span className="ingredient-name">{ing.name}</span>
              {ing.swap && <span className="swap-note">swap: {ing.swap}</span>}
            </div>
            <span className="ingredient-amount">
              {formatAmount(ing.scaledAmount)} {ing.unit}
            </span>
          </li>
        ))}
      </ul>

      <p className="section-label">Steps</p>
      <div className="progress-bar">
        <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
      </div>
      <ol className="step-list">
        {recipe.steps.map((step, i) => {
          const checked = checkedSteps.has(i);
          return (
            <li className="step-row" key={i}>
              <button
                type="button"
                className={`step-check${checked ? ' checked' : ''}`}
                aria-pressed={checked}
                aria-label={checked ? 'Mark step not done' : 'Mark step done'}
                onClick={() => toggleStep(i)}
              >
                {checked ? '✓' : ''}
              </button>
              <span className={`step-text${checked ? ' done' : ''}`}>
                <span className="step-number">{i + 1}.</span>
                {step.text}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="card-footer">
        <span className="hint">
          {doneCount}/{totalSteps} steps done
        </span>
        <button type="button" className="reset-link" onClick={onReset}>
          Start over
        </button>
      </div>
    </article>
  );
}
