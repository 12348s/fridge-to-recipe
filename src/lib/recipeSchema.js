import { z } from 'zod';

// This is the contract we hold the model to. Anything that doesn't match
// gets rejected here rather than partially rendered by the UI — the whole
// point of the assignment is not trusting raw model output.
export const recipeSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().default(''),
  baseServings: z.number().int().positive().max(50),
  totalTimeMinutes: z.number().int().positive().max(1440).optional(),
  ingredients: z
    .array(
      z.object({
        name: z.string().min(1),
        amount: z.number().nonnegative(),
        unit: z.string().optional().default(''),
        swap: z.string().optional().default(''),
      })
    )
    .min(1),
  steps: z
    .array(
      z.object({
        text: z.string().min(1),
      })
    )
    .min(1),
});

/**
 * Attempts to turn raw model text into a validated recipe object.
 * Never throws — always returns a result object so callers can render
 * a controlled error state instead of crashing.
 */
export function parseRecipeResponse(rawText) {
  let candidate;

  try {
    candidate = extractJson(rawText);
  } catch (err) {
    return {
      ok: false,
      stage: 'json',
      message: 'The response was not valid JSON.',
      detail: err.message,
    };
  }

  const result = recipeSchema.safeParse(candidate);

  if (!result.success) {
    return {
      ok: false,
      stage: 'schema',
      message: "The response was JSON, but didn't match the expected recipe shape.",
      detail: result.error.issues
        .slice(0, 4)
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; '),
    };
  }

  return { ok: true, data: result.data };
}

// Models sometimes wrap JSON in prose or markdown fences even when told not
// to. Try a straight parse first, then fall back to pulling out the first
// {...} block before giving up.
function extractJson(text) {
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Empty response body.');
  }

  try {
    return JSON.parse(text);
  } catch {
    // fall through to fence/brace extraction
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // fall through
    }
  }

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return JSON.parse(text.slice(firstBrace, lastBrace + 1));
  }

  throw new Error('Could not locate a JSON object in the response.');
}
