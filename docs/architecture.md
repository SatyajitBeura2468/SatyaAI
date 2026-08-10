# Architecture

SatyaAI uses a modular monolith for V0.1. Presentation components own interaction state; a future `ConversationOrchestrator` should call provider, perception, search, research, and verifier interfaces without leaking SDK types into the UI.

Modes are product concepts, not model names. Each mode can select a preferred provider and capability budget later: Fast prioritises latency, Smart balances quality and speed, and Deep Think allows multi-pass verification.

## Provider boundary

`AIProvider` should expose `capabilities`, `load()`, and `stream(request)`. Candidate adapters are Browser WebLLM, Ollama, vLLM, and OpenAI-compatible HTTP. Model IDs belong in one configuration module.
