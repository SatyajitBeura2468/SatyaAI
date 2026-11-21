# Drishti

Drishti is SatyaAI's image-generation workspace. The web app is a static interface; image inference runs through an optional local companion on the user's own computer. The browser sends prompts only to the loopback companion and never to SatyaSom chat or the configured text endpoint.

## Product tiers and verified checkpoint metadata

| Product tier | Internal checkpoint | License | Size and hardware notes |
|---|---|---|---|
| Drishti Lite 1.0 | `segmind/SSD-1B` | Apache-2.0 | 1.3B parameters; a primary safetensors file is about 4.47 GB. CUDA is recommended; CPU is best-effort only. |
| Drishti Core 1.5 | `black-forest-labs/FLUX.2-klein-4B` | Apache-2.0 | 4B parameters; BF16 transformer weights are about 7.75 GB; upstream guidance cites about 13 GB VRAM. |
| Drishti Ultra 2.0 | `Qwen/Qwen-Image-2512` | Apache-2.0 | 20B parameters; an upstream BF16 serving benchmark reports about 59 GiB peak VRAM on an A800. |
| Drishti X 3.0 MAX | `MiniMaxAI/MiniMax-H3-Image` | MiniMax-H3-Image Community License Agreement | 33.1B image-transformer parameters; the model card lists about 66.28 GB of transformer files, 2.34 GB of VAE files and a separate 66.7 GB text encoder. Conservative gate: about 70 GB free VRAM on an 80 GB-class GPU and 140 GB free disk, using the official component-offload implementation. |

MiniMax-H3-Image is open-weight, but it is **not** Apache-2.0 and should not be described as an unrestricted open-source model. Its license must be read and accepted separately before the X tier is enabled. The companion leaves it disabled by default. The licence excludes the EU, UK, South Korea and the United States; do not enable the model unless the full agreement confirms that your use and territory are permitted.

## Runtime architecture

1. Vercel hosts the UI only. It does not receive prompts for image generation and does not store image model weights.
2. The browser probes `http://127.0.0.1:7860/health` when Image mode is opened or the selected Drishti tier changes.
3. The Generate control is enabled only when the local companion responds and reports that the selected tier passes its disk, hardware and license checks.
4. The browser sends the prompt to `http://127.0.0.1:7860/v1/generate`. It does not call the SatyaSom chat route, the text model, or a hosted generation API.
5. The companion loads only the selected model. Hugging Face's local cache is reused across generations and model restarts; switching models releases the previous pipeline to limit memory use.
6. Generated PNG output is returned to the browser for preview and download. Inference remains local.

## Local companion setup

See [`runtime/README.md`](../runtime/README.md) for Windows setup and troubleshooting. Python, PyTorch and the current Diffusers source package are required. The companion binds to loopback only, uses a strict CORS allowlist, and exposes no LAN listener.

The browser client is intentionally pinned to `http://127.0.0.1:7860`; it does not accept a remote runtime URL. This prevents image prompts from silently leaving the user's device.

## Hardware gates

- Lite: uses SSD-1B. A CUDA GPU is recommended; a low-resolution CPU fallback is best-effort and can be slow.
- Core: the local profile requires a CUDA device with about 13 GB free VRAM.
- Ultra: the local BF16 profile requires about 60 GB free VRAM. This is a conservative gate based on a published A800 serving benchmark, not a universal minimum for every quantized pipeline.
- X: the local profile conservatively requires about 140 GB free VRAM and 150 GB free disk. The MiniMax model card lists very large transformer and text-encoder assets. The tier stays disabled unless the user explicitly acknowledges its community license in the local runtime environment.

These are conservative runtime gates, not guarantees that every GPU of a listed capacity will work. Actual memory use varies with driver, precision, resolution and library versions. If model loading fails or the GPU runs out of memory, the companion returns an error and the UI does not silently fall back to a cloud model.

## Privacy boundaries

- No image prompt or generated image is transmitted to SatyaAI's text inference endpoint.
- The companion binds to `127.0.0.1`, not `0.0.0.0`.
- CORS allows only the configured SatyaAI production origins and local development origins.
- The selected checkpoint is downloaded from its upstream model repository only when it is first needed. The model cache remains on the user's computer.
- The image result stays in the browser session unless the user explicitly downloads it.

## Current status

The frontend-to-companion request/response pipeline and the local Diffusers service are implemented. The Vercel deployment itself does not bundle the companion process or any checkpoint files. A generation succeeds only after the companion has been installed and started on the same computer and the selected model passes its local eligibility check. This repository does not claim that a model is running merely because its name appears in the selector.

## Sources

- SSD-1B model card: https://huggingface.co/segmind/SSD-1B
- FLUX.2 Klein 4B model card: https://huggingface.co/black-forest-labs/FLUX.2-klein-4B
- Qwen-Image-2512 model card: https://huggingface.co/Qwen/Qwen-Image-2512
- MiniMax-H3-Image model card and license: https://huggingface.co/MiniMaxAI/MiniMax-H3-Image
- Upstream Qwen serving recipe: https://github.com/vllm-project/vllm-omni/blob/main/recipes/Qwen/Qwen-Image-2512.md