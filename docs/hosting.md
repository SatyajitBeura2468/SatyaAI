# Hosted inference setup

Fast, Smart and Deep use the Vercel chat gateway. Configure these environment variables in the Vercel project:

| Variable | Purpose |
| --- | --- |
| `REMOTE_MODEL_BASE_URL` | OpenAI-compatible API base URL, ending in `/v1` |
| `REMOTE_MODEL_API_KEY` | Provider API key, stored only in Vercel |
| `REMOTE_MODEL_ID` | Exact model identifier accepted by the provider |

Set the variables for both Production and Preview as appropriate, then redeploy the project. The gateway uses server-side credentials, enforces request validation and per-instance rate limiting, and can stream OpenAI-compatible server-sent events to the browser.

Do not put provider secrets in `VITE_*` variables, client-side source, or the repository. The browser-local fallback for Fast, Smart and Deep is disabled by default. Users can explicitly enable it under Settings → Models & inference. Anu (Nano) always stays on-device and requires WebGPU.

The Vercel project should be checked after configuration with a request to `/api/health`. A configured response reports `configured: true`; this health response does not expose the provider key.
