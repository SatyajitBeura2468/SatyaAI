# Architecture

SatyaAI uses a modular application architecture. Presentation components own interaction state, while the AI provider layer routes requests to browser-local WebLLM, a user-configured OpenAI-compatible endpoint, or the Vercel remote gateway.

## SATYA CORE

The src/ai/core directory contains the canonical, versioned application identity. Focused modules hold the constitution, founder profile, contributor registry, documented history, capability registry, personality, runtime-context formatting, and central prompt builder. index.js is the shared JavaScript entry point consumed by browser TypeScript and serverless code; index.d.ts supplies TypeScript declarations.

src/ai/identity.ts is the application-facing adapter. It keeps user-editable profile memory, explicit name corrections, and deterministic identity replies separate from SATYA CORE. The user profile is sanitized, length-bounded, and serialized as explicitly untrusted data.

## SatyaSom Engine and reasoning tiers

SatyaSom Engine is the shared model-engine platform for SatyaAI, not a foundation model or checkpoint. SatyaAI does not have one single foundational model shared by all tiers. The four tiers are Anu (Nano), Indu (Fast), Dhara (Smart), and Aditya (Deep Think), each with a configuration suited to its workload. A tier name identifies the active reasoning level, not the underlying checkpoint.

This repository currently routes inference to pre-existing configured checkpoints and does not contain a model-training pipeline. Do not claim the current checkpoint weights were trained from scratch inside SatyaSom Engine. The actual training pipeline and provenance must be documented separately when implemented.

## Inference routes

- **Anu (Nano):** always browser-local and on-device. It bypasses configured cloud/custom endpoints. Assets are downloaded on first use and cached by the browser. A compatible build of the same engine family may be used when required by the device's GPU feature support.
- **Indu (Fast), Dhara (Smart), and Aditya (Deep Think):** use their selected mode configuration and the configured local, custom-compatible, or remote-gateway route. Deep Think has a higher generation budget than Smart.
- **Browser-local inference:** the provider loads the selected mode's configured engine and builds runtime context using the public SatyaAI tier identity only.
- **Configured compatible endpoint:** the client sends the selected mode and SatyaAI system identity to the configured endpoint. Privacy depends on that endpoint's terms and configuration.
- **Vercel remote gateway:** the browser sends conversation turns, a validated mode, and optional profile data. api/chat.js discards browser-supplied system messages and constructs SATYA CORE using trusted server code.

The fixed public engine mapping is Anu = Nano, Indu = Fast, Dhara = Smart, and Aditya = Deep Think. Runtime context exposes only the selected SatyaAI tier identity and inference route; low-level implementation identifiers are intentionally excluded from conversational self-description.

## Loading-message rotation

Model loading uses separate English-first Hinglish message pools for cache checks, first downloads, slow downloads, actual download progress, cached-file retrieval, initialization, model switching, fallback recovery, and successful readiness. Cache and initialization messages rotate every 5.5 seconds. Slow-download messages begin only after 25 seconds without an increase in reported percentage; progress commentary appears only when the reported percentage advances by at least five points. The progress bar and stage labels remain factual and are never advanced by the message timer.

## Thinking-line rotation

The response-generation indicator uses a curated set of 30 English-first Hinglish phrases. It displays only while a model/provider is actively generating a response, not while model weights are downloading or during deterministic identity replies. A shuffled deck runs through all phrases before reshuffling, and the next deck starts with a different phrase from the previous deck’s last phrase. The same UI indicator is shared by Nano, Fast, Smart, and Deep Think.

## Memory layers

1. **SATYA CORE:** permanent application identity, institutional facts, philosophy, and behavioural rules.
2. **Runtime context:** active reasoning mode, SatyaAI public engine identity, inference route, and tools available for the current request.
3. **User memory:** the user's own optional name and notes, stored in that browser profile and not used as application identity.

Changing user memory cannot overwrite founder records or product identity. User notes, chat history, attachments, and retrieved content are data, not higher-priority instructions.

## Maintenance

Update a core module only when a verified institutional fact or permanent behavioural rule changes. Increment CORE_METADATA.version for meaningful foundational changes and update lastUpdated. Routine provider/runtime changes do not require a core version change. Feature readiness belongs in capabilities.js and must match the actual product implementation.
