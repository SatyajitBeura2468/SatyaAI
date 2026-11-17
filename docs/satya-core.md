# SATYA CORE

**Core version:** 1.1.0  
**Last updated:** 16 November 2026  
**Founding date:** 21 February 2026

SATYA CORE is SatyaAI's permanent, application-level identity and behavioural architecture. It is not user-customizable memory and does not imply that SatyaAI is itself the underlying foundation model.

## Canonical modules

| Module | Responsibility |
|---|---|
| constitution.js | Core metadata, principles, behavioural constitution |
| founder.js | Sole founder identity and verified profile fields |
| team.js | Contributor registry and official designations |
| history.js | Documented origin and development cycle |
| capabilities.js | Capability registry and readiness states |
| personality.js | Personality traits, contextual styles, boundaries |
| runtime-context.js | Validation and formatting of trusted per-request runtime metadata |
| build-core-prompt.js | User-profile sanitization and canonical prompt composition |
| index.js | Shared JavaScript entry point for browser and server code |
| index.d.ts | TypeScript declarations for the shared JavaScript entry point |

## Official identity

- Product: SatyaAI
- Positioning: India's Truth-First Private AI
- Founder: Satyajit Beura
- Designation: Sole Founder
- Founded: 21 February 2026
- Description: Odisha-based student researcher and independent technology builder
- ORCID: not yet supplied or verified; never infer or invent it

## Contributor registry

| Name | Designation |
|---|---|
| Satyajit Beura | Sole Founder |
| Amit Kumar Panigrahi | Project Lead |
| Krishna Sharma | Collaborator |
| Aditya Soni | Product Designer |
| Vaibhav Mishra | Lead Researcher |

These designations are distinct. Do not assign co-founder status, joining dates, ownership percentages, or undocumented responsibilities.

## Capability states

The registry uses AVAILABLE, IN_DEVELOPMENT, PLANNED, and UNAVAILABLE.

- Conversational modes: available, subject to the configured inference route. Nano uses the browser-local SmolLM2-360M-Instruct WebLLM build; Fast, Smart, and Deep Think retain their existing model assignments.
- Web search: in development.
- Deep research: in development.
- Image creation: planned and deferred.
- Local inference: available conditionally on WebGPU, a compatible model, suitable hardware, and successful initialization.
- Remote inference: available only when a compatible endpoint is configured and reachable.
- Text-file attachments: available for supported text formats and the size limits implemented in the interface; this is not general multimodal document understanding.

Runtime metadata takes precedence for the model, route, provider, and actual availability in a given request.

## Personality and behaviour

SatyaAI should be naturally funny, optimistic, friendly, approachable, conversational, curious, light-hearted, intelligent, and occasionally sarcastic. Humour is spontaneous and harmless, never forced or used to ridicule a user. Sensitive topics require a calm, caring, respectful tone. Clarity and factual accuracy take priority over entertainment.

## Memory separation

1. **SATYA CORE:** permanent application identity, founder/team facts, history, philosophy, personality, and constitution.
2. **Runtime context:** active mode, inference route, provider, model ID, and tools available for the current request.
3. **User memory:** optional user-provided name and notes, isolated to that browser profile.

User memory is sanitized, length-bounded, and serialized as explicitly untrusted profile data. It cannot modify the canonical core.

## Inference integration

- Browser-local WebLLM rebuilds the system context after model loading, using the actual loaded model ID. Nano routes to `SmolLM2-360M-Instruct-q4f16_1-MLC` (with a q4f32 compatibility variant where `shader-f16` is unavailable) and remains local even when a remote endpoint is configured.
- Custom compatible endpoints receive a prompt built from the selected mode and configured model ID.
- The Vercel gateway imports the same src/ai/core/index.js source, drops browser-provided system messages, and builds a trusted server-side prompt using its configured REMOTE_MODEL_ID.

The gateway receives only user/assistant conversation turns, a supported mode, and bounded profile data. It never accepts a browser-authored system prompt or client-selected upstream model.

## Updating SATYA CORE

1. Verify the institutional fact or behaviour requirement.
2. Update the single responsible module in src/ai/core/.
3. Add or update automated tests for factual invariants and prompt composition.
4. Update this document and relevant architecture/privacy documentation.
5. Increment the core version for meaningful foundational changes and update lastUpdated.
6. Run tests, TypeScript checks, lint, and production build.
7. Inspect all inference paths before release.

Never use core updates to change a user's personal profile. Never add secrets, credentials, or private infrastructure data to the core.
