// Remote model gateway (Vercel serverless function).
// The browser never sees the provider key, and the client cannot choose the model,
// the system prompt, or an unbounded token budget.

const SYSTEM_PROMPT = 'You are SatyaAI, a concise and honest assistant. Say when you are uncertain.';
const MAX_MESSAGES = 40;
const MAX_CHARS = 24000;
const MAX_TOKENS_CAP = 2048;
const DEFAULT_MAX_TOKENS = 512;
const UPSTREAM_TIMEOUT_MS = 45000;
const RATE_LIMIT = 20; // requests
const RATE_WINDOW_MS = 60000; // per minute, per client IP

// Best-effort limiter: memory is per serverless instance, so it slows abuse but is not a hard
// guarantee. For strict limits add Vercel Firewall rate limiting or a shared store (e.g. Upstash).
const hits = new Map();

function clientKey(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function isRateLimited(key) {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < RATE_WINDOW_MS)) hits.delete(k);
  return recent.length > RATE_LIMIT;
}

function parseBody(raw) {
  if (raw == null) return {};
  if (typeof raw === 'string') return JSON.parse(raw);
  return raw;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  const base = process.env.REMOTE_MODEL_BASE_URL?.replace(/\/$/, '');
  const key = process.env.REMOTE_MODEL_API_KEY;
  const model = process.env.REMOTE_MODEL_ID;
  if (!base || !key || !model) {
    return res.status(503).json({ error: 'Remote model gateway is not configured. Add REMOTE_MODEL_BASE_URL, REMOTE_MODEL_API_KEY, and REMOTE_MODEL_ID in Vercel.' });
  }

  if (isRateLimited(clientKey(req))) return res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });

  let body;
  try { body = parseBody(req.body); } catch { return res.status(400).json({ error: 'Request body must be valid JSON.' }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({ error: 'Request body must be a JSON object.' });

  if (!Array.isArray(body.messages) || body.messages.length === 0) return res.status(400).json({ error: '`messages` must be a non-empty array.' });
  if (body.messages.length > MAX_MESSAGES) return res.status(413).json({ error: `Too many messages (max ${MAX_MESSAGES}).` });

  // Only user/assistant turns are accepted from the client. The system prompt is ours.
  const turns = [];
  for (const m of body.messages) {
    if (!m || typeof m.content !== 'string' || !m.content.trim()) return res.status(400).json({ error: 'Every message needs non-empty string content.' });
    if (m.role === 'user' || m.role === 'assistant') turns.push({ role: m.role, content: m.content });
    else if (m.role !== 'system') return res.status(400).json({ error: 'Unsupported message role.' });
  }
  if (turns.length === 0 || turns[turns.length - 1].role !== 'user') return res.status(400).json({ error: 'The last message must be from the user.' });
  if (turns.reduce((sum, m) => sum + m.content.length, 0) > MAX_CHARS) return res.status(413).json({ error: `Prompt too long (max ${MAX_CHARS} characters).` });

  const requested = Number(body.max_tokens);
  const maxTokens = Number.isFinite(requested) && requested > 0 ? Math.min(Math.floor(requested), MAX_TOKENS_CAP) : DEFAULT_MAX_TOKENS;
  const temp = Number(body.temperature);
  const temperature = Number.isFinite(temp) ? Math.min(Math.max(temp, 0), 1.2) : 0.4;

  let upstream;
  try {
    upstream = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...turns], temperature, max_tokens: maxTokens, stream: false }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    return res.status(timedOut ? 504 : 502).json({ error: timedOut ? 'The remote model took too long to respond.' : 'Could not reach the remote model provider.' });
  }

  let data;
  try { data = JSON.parse(await upstream.text()); } catch { return res.status(502).json({ error: 'The remote model provider returned an unreadable response.' }); }

  // Upstream failures are always reported as 502 so they can never be mistaken for
  // "this gateway route does not exist" (404) or "gateway not configured" (503).
  if (!upstream.ok) {
    const detail = typeof data?.error === 'string' ? data.error : typeof data?.error?.message === 'string' ? data.error.message : '';
    return res.status(502).json({ error: `Remote model provider error (${upstream.status})${detail ? `: ${detail.slice(0, 200)}` : ''}` });
  }
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content) return res.status(502).json({ error: 'The remote model returned no content.' });
  return res.status(200).json({ choices: [{ message: { role: 'assistant', content } }] });
}
