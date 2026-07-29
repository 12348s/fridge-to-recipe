# Fridge → Recipe

Type in whatever's in your fridge, in plain free-form text. The app sends it to an
LLM, which returns a recipe as structured JSON — not a chat reply — and the UI
renders it as an interactive card: scale servings up or down, check off steps as
you cook, and see substitute suggestions per ingredient.

## Setup

```bash
npm install
cp .env.example .env
# edit .env and add your LLM_API_KEY (Groq's free tier works — see .env.example)
npm start
```

`npm start` runs the Vite dev server (React app, port 5173) and a small Express
proxy (port 8787) together. The React app never talks to the LLM directly — it
calls `/api/recipe` on our own server, which holds the API key and forwards the
request. Vite proxies `/api/*` to the Express server in dev (see
`vite.config.js`); in production, deploy `server/index.js`'s route as whatever
serverless function your host uses, at the same path.

Open **http://localhost:5173**.

## How it works

1. User types ingredients into a free-form textarea.
2. `POST /api/recipe` → Express server → LLM, with a system prompt that pins
   down an exact JSON shape and asks for `response_format: json_object`.
3. The server passes the model's raw text straight back to the client — it
   does **not** trust or reshape it.
4. The client (`src/lib/recipeSchema.js`) is where validation actually
   happens: it tries to extract JSON (handling stray markdown fences models
   sometimes add despite instructions), then validates it against a Zod
   schema. Only a fully valid object reaches `setRecipe(...)`.
5. `RecipeCard` renders the validated data as stateful UI — servings
   scaling recalculates every ingredient amount client-side; steps are an
   independent checklist with progress tracking.

## Usage

1. Type what's in your fridge in plain language (e.g. "eggs, spinach, feta, half an onion").
2. Hit "Get a recipe."
3. Adjust the servings +/- to scale all ingredient amounts.
4. Check off steps as you cook — the progress bar tracks completion.
5. Click "Start over" to clear and try different ingredients.   

## Handling bad output

This was the part I spent the most time on, per the brief:

- **Malformed JSON** — `parseRecipeResponse` tries a plain `JSON.parse`,
  then falls back to stripping markdown code fences, then falls back to
  slicing out the first `{...}` block, before giving up and showing an
  error with a **Try again** button.
- **Wrong shape** (missing fields, wrong types, empty arrays) — caught by
  the Zod schema in `recipeSchema.js`, with a specific, truncated list of
  which fields failed shown in the error state (not a generic "something
  went wrong").
- **Empty response** — the server checks for an empty `content` string
  from the model and returns a clear `502` before it ever reaches the
  client.
- **Slow / hung requests** — both the client (`lib/api.js`) and server
  (`server/index.js`) enforce their own timeouts via `AbortController`, so
  a hung upstream call doesn't hang the UI forever.
- **Provider/network failures** — upstream non-2xx responses are caught
  server-side and turned into a clean `502` with a short explanation
  rather than leaking raw provider error bodies to the client.
- **Stale responses** — every submit gets an incrementing request id
  (`requestIdRef` in `App.jsx`) and aborts the previous in-flight request.
  If an old response somehow resolves after a newer one was started, it's
  discarded rather than overwriting the current recipe. This matters
  because someone editing their ingredient list and hitting submit twice
  quickly is a completely normal interaction, not an edge case.
- **No crashes on bad input** — every parse/validate step returns a result
  object (`{ ok, data | message, detail }`) instead of throwing across
  component boundaries, so a bad model response always lands in the
  `error` UI state, never a white screen.

## AI-usage note

I used an AI assistant (Claude) while building this — mainly to scaffold
boilerplate faster (Vite config, the Express proxy skeleton, CSS for the
recipe-card layout) and to sanity-check the JSON-repair fallback logic in
`recipeSchema.js`. I wrote/reviewed and can explain every file; the
architecture decisions (client-side validation as the source of truth,
request-id based stale-response guarding, server never reshaping model
output) were mine. I did not copy this from an existing repo or tutorial.

## Known limitations

- No streaming — stretch goal, not implemented. The full JSON is parsed
  once the response completes.
- No refinement loop (follow-up prompts that edit the existing recipe) —
  "Start over" just clears state and starts a fresh request.
- No persistence — recipes aren't saved between page reloads.
- Ingredient "swap" suggestions are whatever the model proposes per
  ingredient; there's no independent verification they're sensible
  substitutes.
- Serving-size scaling is naive linear multiplication — fine for most
  recipes, not chemically accurate for things like baking leavening ratios.
- Only one block/render type (the recipe card) — the stretch goal of
  multiple block kinds (chart, chart, checklist as separate composable
  types) wasn't built.
- The model may occasionally add common pantry ingredients beyond exactly what the user listed (observed with sparse input like "water"). This is a prompt-tuning tradeoff, not a validation failure — the JSON returned is always structurally valid.  

**What I'd do next** with more time: streaming the response in so the card
fills in progressively instead of waiting for the full JSON; a refinement
loop ("swap the chicken for tofu") that sends the current recipe back to
the model as context instead of regenerating from scratch; and session
save/reload via localStorage.

## Time spent

~8 hours.

## Stack

- React 18 (hooks, functional components), Vite
- Express (thin proxy — the only place the API key lives)
- Zod for response validation
- Provider: Groq (OpenAI-compatible endpoint) by default; swappable via
  `.env` to OpenAI or a local Ollama model — see `.env.example`.
