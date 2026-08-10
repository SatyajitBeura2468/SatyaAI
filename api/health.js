export default function handler(_req, res) {
  res.status(200).json({ ok: true, service: 'satyaai', mode: 'remote-provider-gateway', configured: Boolean(process.env.REMOTE_MODEL_BASE_URL && process.env.REMOTE_MODEL_API_KEY && process.env.REMOTE_MODEL_ID) });
}
