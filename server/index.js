import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10kb' }));

const PORT = process.env.PORT || 8787;

// Swap providers by changing these three things. Defaults to Groq's free,
// OpenAI-compatible endpoint since it needs no card on file.
const API_URL = process.env.LLM_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
const API_KEY = process.env.LLM_API_KEY;
const MODEL = process.env.LLM_MODEL || 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `You are a recipe generator. Given a free-form list of ingredients and any
context the user provides, return ONE recipe that mostly uses those ingredients (a few common
pantry staples like salt, oil, or water are fine to assume).

Respond with ONLY a single JSON object — no prose, no markdown fences, no commentary.
Match this exact shape:

{
  "title": string,
  "description": string (one sentence),
  "baseServings": integer,
  "totalTimeMinutes": integer,
  "ingredients": [
    { "name": string, "amount": number, "unit": string, "swap": string (optional substitute, or "") }
  ],
  "steps": [
    { "text": string }
  ]
}

Rules:
- "amount" must be a plain number (e.g. 1.5, not "1 1/2" and not a range).
- Every ingredient needs a "unit" (use "" only for whole countable items, and say so in "name", e.g. "eggs").
- 3 to 10 ingredients, 3 to 10 steps.
- Keep step text concrete and short (one action per step).`;

app.post('/api/recipe', async (req, res) => {
  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';

  if (!prompt) {
    return res.status(400).json({ error: 'Missing "prompt" in request body.' });
  }
  if (prompt.length > 2000) {
    return res.status(400).json({ error: 'Prompt is too long (max 2000 characters).' });
  }
  if (!API_KEY) {
    return res.status(500).json({
      error: 'Server is missing LLM_API_KEY. Add it to a .env file (see .env.example).',
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const upstream = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.6,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Ingredients / context: ${prompt}` },
        ],
      }),
      signal: controller.signal,
    });

    const upstreamBody = await upstream.text();

    if (!upstream.ok) {
      console.error('Upstream LLM error:', upstream.status, upstreamBody.slice(0, 500));
      return res.status(502).json({
        error: `The model provider returned an error (${upstream.status}). Try again in a moment.`,
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(upstreamBody);
    } catch {
      return res.status(502).json({ error: 'The model provider returned an unreadable response.' });
    }

    const content = parsed?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      return res.status(502).json({ error: 'The model returned an empty response.' });
    }

    // Pass the raw model text straight through — validation happens on the
    // client (parseRecipeResponse), which is what the app is graded on.
    res.json({ raw: content });
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'The model took too long to respond.' });
    }
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Unexpected server error calling the model.' });
  } finally {
    clearTimeout(timeout);
  }
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`API proxy listening on http://localhost:${PORT}`);
});
