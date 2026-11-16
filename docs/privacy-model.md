# Privacy model

The current application does not require an account. User profile memory, chat history, saved answers, theme, and avatar are stored in the current browser's local storage. They are not part of SATYA CORE and are not synced between users or devices.

## Inference routes

- **Browser-local WebLLM:** prompt and conversation processing occur in the browser worker. Model files may be downloaded and cached by WebLLM; downloading weights is not the same as sending conversation content to a remote inference API.
- **User-configured compatible endpoint:** prompts, conversation history, and relevant profile context are sent to the endpoint configured by the user. That endpoint's own privacy and retention terms apply.
- **Vercel remote gateway:** the browser sends conversation turns and optional bounded profile data to the gateway. The gateway constructs SATYA CORE server-side, forwards the prompt to the configured remote provider, and keeps the provider key on the server. The gateway does not persist profile data or conversation messages in an application database.

A remote inference route is not local execution. Do not promise that every route is private or on-device. Users should choose a provider whose data-handling terms they understand.

## Trust boundaries

The server discards browser-supplied system messages and constructs permanent application context from shared application code. User messages, attached files, profile notes, and retrieved content are untrusted data and must not override system instructions. API keys and infrastructure secrets must never be stored in SATYA CORE or exposed to the browser.

Do not add hidden analytics or telemetry. Future persistence, account, retrieval, or analytics services require a separately documented data-flow and privacy review.
