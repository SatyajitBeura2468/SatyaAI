# Local-first inference

SatyaAI does not require hosted model credentials to answer messages.

All four reasoning tiers run locally in the browser through WebLLM/WebGPU:

| SatyaAI tier | Default inference |
| --- | --- |
| Anu (Nano) | Browser-local |
| Indu (Fast) | Browser-local |
| Dhara (Smart) | Browser-local |
| Aditya (Deep Think) | Browser-local |

On first use, the selected model is downloaded to the browser's model cache. Later sessions reuse the cached files. Local inference requires a supported browser, WebGPU, sufficient GPU memory and available storage. A model's size and performance depend on the tier and device.

## Optional remote endpoint

A user may deliberately configure an OpenAI-compatible endpoint under Settings → Models & inference. For non-Nano tiers, SatyaAI then sends the prompt and conversation context directly to the configured endpoint. Its operator's privacy policy and usage terms apply.

The default local-first app does not call `/api/chat` or `/api/health`, and does not need `REMOTE_MODEL_BASE_URL`, `REMOTE_MODEL_API_KEY`, or `REMOTE_MODEL_ID` in Vercel. The API gateway source is retained for possible future deployments but is not part of the normal local inference path.
