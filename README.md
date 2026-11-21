# SatyaAI

Truth-first intelligence for reasoning, research, and creation.

### [Open SatyaAI →](https://satyaai-five.vercel.app)

SatyaAI V0.1 is a privacy-conscious, local-first AI application. Its model family is built on the from-scratch SatyaSom Engine Architecture. It includes four purpose-built variants: Anu (Nano), Indu (Fast), Dhara (Smart), and Aditya (Deep Think), designed for different model scales, parameter configurations, capabilities, and use cases. No one variant is the foundation model for the others. When WebGPU is available, text inference runs locally in the browser and model assets are cached on the device. If local inference is unavailable, SatyaAI reports the limitation instead of fabricating model output, citations, or search results.

## Run locally

```bash
pnpm install
pnpm dev
```

Optional compatible endpoints can be configured with `.env.example`. No paid API is required for the default boot path.

## Architecture

```mermaid
flowchart TD
  User --> UI[SatyaAI UI]
  UI --> Orchestrator[Conversation Orchestrator]
  Orchestrator --> Modes[Nano / Fast / Smart / Deep Think]
  Orchestrator --> Perception[Text / Drishti images / Audio / Video / Documents]
  Orchestrator --> Tools[Search / Research / Retrieval]
  Orchestrator --> Providers[Provider Layer]
  Providers --> Local[Browser WebGPU / WebLLM]
  Providers --> Remote[Ollama / vLLM / OpenAI-compatible]
```

## Honest V0.1 boundaries

Browser-local text inference is implemented when the browser and device support WebGPU. Anu (Nano) is always on-device. Engine identity and reasoning-mode labels are application-owned; low-level implementation identifiers are kept separate from the user-facing product identity. The Drishti Image workspace and model registry are being integrated; local image generation is not yet operational. Web search, SearXNG integration, citation-backed research, audio transcription, video keyframe extraction, and general multimodal document understanding remain separate capabilities that require additional implementation.

See [`docs/architecture.md`](docs/architecture.md), [`docs/privacy-model.md`](docs/privacy-model.md), and [`docs/future-training.md`](docs/future-training.md).


## SATYA CORE

SATYA CORE is SatyaAI's versioned, application-level source of truth for product identity, founder and contributor records, documented origin, philosophy, capability status, personality, and behavioural rules. It is separate from each user's editable profile memory and from dynamic inference metadata.

The shared core is used by browser-local inference, user-configured compatible endpoints, and the Vercel remote gateway. The gateway constructs its system context on the server and discards browser-supplied system messages.

During response generation, all model modes share a rotating set of 30 English-first Hinglish status lines. They are shuffled without immediate repeats and remain separate from model-download progress. Browser-local model loading has separate stage-specific message pools for cache checks, downloads, slow waits, progress, cache retrieval, initialization, model switching, recovery, and readiness.

See [docs/satya-core.md](docs/satya-core.md) for architecture, current status, privacy boundaries, and maintenance instructions.
