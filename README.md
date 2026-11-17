# SatyaAI

Truth-first intelligence for reasoning, research, and creation.

### [Open SatyaAI →](https://satyaai-five.vercel.app)

SatyaAI V0.1 is a privacy-conscious, local-first AI application. It exposes Nano, Fast, Smart, and Deep Think modes without coupling the UI to a model vendor. When WebGPU is available, text inference runs in the browser through WebLLM. Nano uses SmolLM2-360M-Instruct and is always on-device; model assets are downloaded on first use and cached by the browser. If local inference is unavailable, SatyaAI reports the limitation instead of fabricating model output, citations, or search results.

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
  Orchestrator --> Perception[Text / Image / Audio / Video / Documents]
  Orchestrator --> Tools[Search / Research / Retrieval]
  Orchestrator --> Providers[Provider Layer]
  Providers --> Local[Browser WebGPU / WebLLM]
  Providers --> Remote[Ollama / vLLM / OpenAI-compatible]
```

## Honest V0.1 boundaries

Browser-local text inference is implemented through WebLLM when the browser and device support WebGPU. Nano uses the 360M-parameter SmolLM2 Instruct model, with weights fetched on demand from the MLC model repository and cached locally. Web search, SearXNG integration, citation-backed research, audio transcription, video keyframe extraction, and general multimodal document understanding remain separate capabilities that require additional implementation and optional infrastructure.

See [`docs/architecture.md`](docs/architecture.md), [`docs/privacy-model.md`](docs/privacy-model.md), and [`docs/future-training.md`](docs/future-training.md).


## SATYA CORE

SATYA CORE is SatyaAI's versioned, application-level source of truth for product identity, founder and contributor records, documented origin, philosophy, capability status, personality, and behavioural rules. It is separate from each user's editable profile memory and from dynamic inference metadata.

The shared core is used by browser-local inference, user-configured compatible endpoints, and the Vercel remote gateway. The gateway constructs its system context on the server and discards browser-supplied system messages.

See [docs/satya-core.md](docs/satya-core.md) for architecture, current status, privacy boundaries, and maintenance instructions.
