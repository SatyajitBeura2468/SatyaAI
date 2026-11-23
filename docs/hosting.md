# Local-first inference

SatyaAI does not require hosted model credentials to answer messages.

All five reasoning tiers run locally in the browser:

| SatyaAI tier | Default inference |
| --- | --- |
| Kaṇa (Nano) | Browser-local ONNX / WebAssembly CPU |
| Anu (Micro) | Browser-local WebLLM / WebGPU |
| Indu (Fast) | Browser-local WebLLM / WebGPU |
| Dhara (Smart) | Browser-local WebLLM / WebGPU |
| Aditya (Deep Think) | Browser-local WebLLM / WebGPU |

On first use, the selected model is downloaded to the browser's model cache. Later sessions reuse the cached files. Local inference requires a supported browser, WebGPU, sufficient GPU memory and available storage. A model's size and performance depend on the tier and device.

## Optional remote endpoint

A user may deliberately configure an OpenAI-compatible endpoint under Settings → Models & inference. For Indu (Fast), Dhara (Smart), and Aditya (Deep Think), SatyaAI then sends the prompt and conversation context directly to the configured endpoint. Its operator's privacy policy and usage terms apply.

The default local-first app does not call `/api/chat` or `/api/health`, and does not need `REMOTE_MODEL_BASE_URL`, `REMOTE_MODEL_API_KEY`, or `REMOTE_MODEL_ID` in Vercel. The API gateway source is retained for possible future deployments but is not part of the normal local inference path.
