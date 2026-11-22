# SatyaAI Privacy Notice

**Effective date: November 22, 2026**

SatyaAI currently has no user account system and no cloud conversation-sync service. Conversation history, saved answers, profile details, preferences and avatar data are stored in this browser unless you disable conversation saving or clear the browser's data. This information is not currently backed up to a SatyaAI account.

All four SatyaAI text tiers use browser-local inference by default. Prompts, conversation context and profile memory are processed on your device by the selected WebLLM model. Model files are downloaded to the browser cache and reused locally. No SatyaAI-hosted inference API or API key is required. If you explicitly configure a custom compatible endpoint in Settings, requests for non-Nano modes are sent directly from your browser to that endpoint; its operator's terms and privacy policy apply. Custom endpoint API keys are kept in memory and are not written to local storage.

Browser-local text inference runs on your device after you opt in and download the selected model. Drishti and Chakshu local image/video workflows communicate with the separately installed local companion on your computer.

For equation and code rendering, the app may load MathJax from jsDelivr and highlight.js plus its stylesheet from Cloudflare's CDN. Those services receive ordinary network request metadata, such as your IP address. The message text is typeset and highlighted in your browser; SatyaAI does not send it to those rendering CDNs.

The static application is hosted on Vercel. Local inference requests do not pass through a SatyaAI hosted model API. Vercel may process ordinary web-hosting request metadata. SatyaAI does not currently provide account-level data access, cloud deletion, cross-device synchronization, or a feedback-report backend. You can export local data from Settings and clear local conversations and saved answers from the app.

For privacy questions, contact the project maintainers through the repository's GitHub Issues page.
