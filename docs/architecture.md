# Architecture

SatyaAI uses a modular application architecture. Presentation components own interaction state, while the AI provider layer routes requests to browser-local WebLLM, a user-configured OpenAI-compatible endpoint, or the Vercel remote gateway.

## SATYA CORE

The src/ai/core directory contains the canonical, versioned application identity. Focused modules hold the constitution, founder profile, contributor registry, documented history, capability registry, personality, runtime-context formatting, and central prompt builder. index.js is the shared JavaScript entry point consumed by browser TypeScript and serverless code; index.d.ts supplies TypeScript declarations.

src/ai/identity.ts is the application-facing adapter. It keeps user-editable profile memory, explicit name corrections, and deterministic identity replies separate from SATYA CORE. The user profile is sanitized, length-bounded, and serialized as explicitly untrusted data.

## Inference routes

- **Nano:** browser-local WebLLM using `SmolLM2-360M-Instruct-q4f16_1-MLC` (estimated 376 MB VRAM, 4K context). It always stays on-device and bypasses configured cloud/custom endpoints. The browser downloads model assets on first use and WebLLM caches them for later sessions. If the adapter lacks `shader-f16`, Nano tries the compatible q4f32 variant.

- **Browser-local WebLLM:** after the active model loads, the provider rebuilds the system context with the actual loaded model ID and browser-local route.
- **Configured compatible endpoint:** the client builds context from the selected mode and configured model ID. The prompt is sent to that endpoint, so privacy depends on its terms and configuration.
- **Vercel remote gateway:** the browser sends only conversation turns, a validated mode, and optional profile data. api/chat.js discards browser-supplied system messages and constructs SATYA CORE using trusted server code and the configured server-side model ID.

Nano, Fast, Smart, and Deep Think are product modes, not model identities. Runtime context distinguishes route, provider, and model when available. Missing model metadata is represented as unknown rather than guessed.

The Nano model weights are fetched from the MLC Hugging Face model repository on first use and cached by WebLLM in the browser. They are intentionally not committed to Git: the repository contains the model identifier and routing integration, not hundreds of megabytes of binary weights.

## Thinking-line rotation

The response-generation indicator uses a curated set of 30 English-first Hinglish phrases. It displays only while a model/provider is actively generating a response, not while model weights are downloading or during deterministic identity replies. A shuffled deck runs through all phrases before reshuffling, and the next deck starts with a different phrase from the previous deck’s last phrase. The same UI indicator is shared by Nano, Fast, Smart, and Deep Think.

## Memory layers

1. **SATYA CORE:** permanent application identity, institutional facts, philosophy, and behavioural rules.
2. **Runtime context:** active mode, inference route, provider, model ID, and tools available for the current request.
3. **User memory:** the user's own optional name and notes, stored in that browser profile and not used as application identity.

Changing user memory cannot overwrite founder records or product identity. User notes, chat history, attachments, and retrieved content are data, not higher-priority instructions.

## Maintenance

Update a core module only when a verified institutional fact or permanent behavioural rule changes. Increment CORE_METADATA.version for meaningful foundational changes and update lastUpdated. Routine provider/runtime changes do not require a core version change. Feature readiness belongs in capabilities.js and must match the actual product implementation.
