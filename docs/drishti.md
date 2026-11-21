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
2. When the user presses **Send** in Image mode, the browser checks the loopback companion and asks the installed Windows companion to start through the `satyaai-drishti://start` protocol. The user does not need to open a terminal or start Python manually.
3. The Windows companion prepares its private runtime on first use. It downloads a pinned, SHA-256-verified copy of uv, which manages Python 3.12 under the user's SatyaAI application-data folder. No system-wide Python installation, winget, or PATH change is required.
4. The companion uses uv's automatic PyTorch backend selection to choose the best supported CPU, NVIDIA CUDA, or Intel accelerator package available for the computer. This setup is cached; later launches reuse it.
5. The browser sends the prompt only to `http://127.0.0.1:7860/v1/generate`. It does not call the SatyaSom chat route, the text model, or a hosted image-generation API.
6. The companion loads only the selected image checkpoint. Hugging Face's local cache is reused; switching models releases the previous pipeline to limit memory use.
7. Generated PNG output is returned to the browser for preview and download. Inference remains local.

## Local companion setup

Install the Windows companion once from the release linked in the Image workspace. The first launch downloads and prepares the private Python and PyTorch runtime automatically; the user does not install Python or enter commands. The selected image checkpoint downloads separately on its first generation request. See [the runtime guide](../runtime/README.md) for details and troubleshooting.

### First connection in Edge or Chrome

On the first **Send** or **Start local engine** action, a recent Chromium browser may ask whether SatyaAI can access the local device/network. Choose **Allow**. Edge 143+ enables Local Network Access restrictions by default; if permission was denied, open Edge Settings → Privacy, search, and services → Site permissions → All permissions → Local network access, and change SatyaAI's permission. Retry the image request after allowing access.

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

The frontend-to-companion request/response pipeline, private runtime bootstrap, local Diffusers service, and Windows installer workflow are implemented. The Vercel deployment does not bundle the companion process or model checkpoints. A generation succeeds only after the one-time Windows companion installation, browser local-network permission (where required), and local model eligibility checks. Publishing the web app alone does not install the companion or make an image model available.

## Sources

- SSD-1B model card: https://huggingface.co/segmind/SSD-1B
- FLUX.2 Klein 4B model card: https://huggingface.co/black-forest-labs/FLUX.2-klein-4B
- Qwen-Image-2512 model card: https://huggingface.co/Qwen/Qwen-Image-2512
- MiniMax-H3-Image model card and license: https://huggingface.co/MiniMaxAI/MiniMax-H3-Image
- Upstream Qwen serving recipe: https://github.com/vllm-project/vllm-omni/blob/main/recipes/Qwen/Qwen-Image-2512.md