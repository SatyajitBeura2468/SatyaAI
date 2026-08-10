export default async function handler(req: Request, res: { status: (code: number) => { json: (body: unknown) => void } }) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
  const base = process.env.REMOTE_MODEL_BASE_URL?.replace(/\/$/, '');
  const key = process.env.REMOTE_MODEL_API_KEY;
  const configuredModel = process.env.REMOTE_MODEL_ID;
  if (!base || !key || !configuredModel) return res.status(503).json({ error: 'Remote model gateway is not configured. Add REMOTE_MODEL_BASE_URL, REMOTE_MODEL_API_KEY, and REMOTE_MODEL_ID in Vercel.' });
  try {
    const body = await req.json() as { messages?: unknown[]; model?: string; temperature?: number; max_tokens?: number };
    const upstream = await fetch(`${base}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ model: body.model || configuredModel, messages: body.messages, temperature: body.temperature ?? 0.4, max_tokens: body.max_tokens ?? 1024, stream: false }) });
    const text = await upstream.text();
    res.status(upstream.status).json(JSON.parse(text));
  } catch (error) { res.status(502).json({ error: error instanceof Error ? error.message : 'Remote provider request failed' }); }
}
