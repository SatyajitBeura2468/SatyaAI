import { buildSatyaCorePrompt } from '../src/ai/core/index.js';

const MAX_MESSAGES = 40;
const MAX_CHARS = 24000;
const MAX_TOKENS_CAP = 8192;
const DEFAULT_MAX_TOKENS = 2048;
const UPSTREAM_TIMEOUT_MS = 90000;
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60000;
const hits = new Map();

function clientKey(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}
function isRateLimited(key) {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((time) => now - time < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    for (const [candidate, timestamps] of hits) {
      if (!timestamps.some((time) => now - time < RATE_WINDOW_MS)) hits.delete(candidate);
    }
  }
  return recent.length > RATE_LIMIT;
}
function parseBody(raw) {
  if (raw == null) return {};
  if (typeof raw === 'string') return JSON.parse(raw);
  return raw;
}
function streamHeaders(res) {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
}
function streamSingleAnswer(res, content) {
  const event = JSON.stringify({ choices: [{ delta: { role: 'assistant', content } }] });
  res.write('data: ' + event + '\n\n');
  res.write('data: [DONE]\n\n');
  res.end();
}
async function parseUpstreamJson(response) {
  try { return JSON.parse(await response.text()); }
  catch { return null; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
  const base = process.env.REMOTE_MODEL_BASE_URL?.replace(/\/$/, '');
  const key = process.env.REMOTE_MODEL_API_KEY;
  const model = process.env.REMOTE_MODEL_ID;
  if (!base || !key || !model) {
    return res.status(503).json({ error: 'Hosted inference is not configured. Add REMOTE_MODEL_BASE_URL, REMOTE_MODEL_API_KEY, and REMOTE_MODEL_ID to the Vercel production environment.' });
  }
  if (isRateLimited(clientKey(req))) return res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });

  let body;
  try { body = parseBody(req.body); }
  catch { return res.status(400).json({ error: 'Request body must be valid JSON.' }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({ error: 'Request body must be a JSON object.' });
  if (!Array.isArray(body.messages) || body.messages.length === 0) return res.status(400).json({ error: 'messages must be a non-empty array.' });
  if (body.messages.length > MAX_MESSAGES) return res.status(413).json({ error: 'Too many messages (max ' + MAX_MESSAGES + ').' });

  const turns = [];
  for (const message of body.messages) {
    if (!message || typeof message.content !== 'string' || !message.content.trim()) {
      return res.status(400).json({ error: 'Every message needs non-empty string content.' });
    }
    if (message.role === 'user' || message.role === 'assistant') turns.push({ role: message.role, content: message.content });
    else if (message.role !== 'system') return res.status(400).json({ error: 'Unsupported message role.' });
  }
  if (turns.length === 0 || turns[turns.length - 1].role !== 'user') return res.status(400).json({ error: 'The last message must be from the user.' });
  if (turns.reduce((sum, message) => sum + message.content.length, 0) > MAX_CHARS) {
    return res.status(413).json({ error: 'Prompt too long (max ' + MAX_CHARS + ' characters).' });
  }

  const mode = ['fast', 'smart', 'deep'].includes(body.mode) ? body.mode : null;
  const systemPrompt = buildSatyaCorePrompt({
    userMemory: body.user_memory,
    runtimeContext: {
      mode,
      inferenceRoute: 'remote-gateway',
      localInferenceAvailable: false,
      remoteInferenceAvailable: true,
    },
  });
  const requested = Number(body.max_tokens);
  const maxTokens = Number.isFinite(requested) && requested > 0
    ? Math.min(Math.floor(requested), MAX_TOKENS_CAP)
    : DEFAULT_MAX_TOKENS;
  const requestedTemperature = Number(body.temperature);
  const temperature = Number.isFinite(requestedTemperature)
    ? Math.min(Math.max(requestedTemperature, 0), 1.2)
    : 0.4;
  const wantsStream = body.stream === true;
  const abortController = new AbortController();
  const onRequestClose = () => {
    if (!res.writableEnded) abortController.abort();
  };
  res.on?.('close', onRequestClose);

  let upstream;
  try {
    upstream = await fetch(base + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: systemPrompt }, ...turns],
        temperature,
        max_tokens: maxTokens,
        stream: wantsStream,
      }),
      signal: AbortSignal.any([AbortSignal.timeout(UPSTREAM_TIMEOUT_MS), abortController.signal]),
    });
  } catch (error) {
    res.off?.('close', onRequestClose);
    const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    return res.status(timedOut ? 504 : 502).json({
      error: timedOut ? 'The remote model took too long to respond.' : 'Could not reach the remote model provider.',
    });
  }

  if (!upstream.ok) {
    const data = await parseUpstreamJson(upstream);
    res.off?.('close', onRequestClose);
    console.error('[SatyaAI] Remote inference request failed:', upstream.status, data?.error);
    return res.status(502).json({ error: 'SatyaAI could not complete the selected engine request. Please try again.' });
  }

  if (wantsStream) {
    const contentType = upstream.headers.get('content-type') || '';
    if (contentType.includes('text/event-stream') && upstream.body) {
      streamHeaders(res);
      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const result = await reader.read();
          if (result.done) break;
          if (abortController.signal.aborted) break;
          const chunk = decoder.decode(result.value, { stream: true });
          if (chunk) res.write(chunk);
        }
        const tail = decoder.decode();
        if (tail && !abortController.signal.aborted) res.write(tail);
        if (!abortController.signal.aborted) res.end();
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.error('[SatyaAI] Stream interrupted:', error);
          res.write('data: {"error":{"message":"The hosted response was interrupted. Retry or continue the answer."}}\n\n');
          res.write('data: [DONE]\n\n');
          res.end();
        }
      } finally {
        reader.releaseLock?.();
        res.off?.('close', onRequestClose);
      }
      return;
    }

    // Providers that ignore stream=true still return a compatible one-shot SSE response.
    const data = await parseUpstreamJson(upstream);
    const content = data?.choices?.[0]?.message?.content;
    res.off?.('close', onRequestClose);
    if (typeof content !== 'string' || !content) {
      return res.status(502).json({ error: 'The remote model returned no content.' });
    }
    streamHeaders(res);
    streamSingleAnswer(res, content);
    return;
  }

  const data = await parseUpstreamJson(upstream);
  res.off?.('close', onRequestClose);
  if (!data) return res.status(502).json({ error: 'The remote model provider returned an unreadable response.' });
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content) return res.status(502).json({ error: 'The remote model returned no content.' });
  return res.status(200).json({ choices: [{ message: { role: 'assistant', content } }] });
}
