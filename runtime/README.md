# Drishti local companion runtime

The Windows companion is the only required desktop setup for the hosted SatyaAI Image workspace. Vercel serves the interface; image inference runs locally on the user's computer. Prompts go to the loopback service at `127.0.0.1:7860`, never to the text chat provider.

## Normal Windows setup (recommended)

1. Install the **SatyaAI Drishti Companion** once using the installer linked in the Image workspace.
2. Keep the companion running in the Windows tray. The first Send action in Image mode will attempt to wake it automatically.
3. On the browser's first local connection, allow SatyaAI's Local Network Access permission if Chrome or Edge asks.
4. Send the image prompt. The companion prepares its private runtime on first use and downloads the selected image checkpoint only when it is first needed.

The user does not need to install Python globally, use winget, change PATH, open PowerShell, or type setup commands. The companion downloads a pinned, SHA-256-verified uv release and uses it to manage Python 3.12, an isolated environment, and the runtime packages under `%LOCALAPPDATA%\\SatyaAI\\Drishti`. That setup is cached for later launches.

PyTorch's automatic backend selection is used for supported CPU, NVIDIA CUDA, or Intel accelerator setups. Detection depends on installed drivers and supported hardware. Lite provides a best-effort CPU path; Core and Ultra have substantial GPU-memory requirements. The user interface must never imply that a model can run just because its name is listed.

## Developer / manual setup

Manual setup is intended only for maintainers who are developing the Python service independently of the Windows companion. Python 3.12, PyTorch, and the packages in `requirements.txt` are required in a development virtual environment.

From the repository's `runtime` directory:

```powershell
python -m venv .venv
.\\.venv\\Scripts\\python.exe -m pip install --upgrade pip
# Install the correct PyTorch build for the local hardware using the official selector:
# https://pytorch.org/get-started/locally/
.\\.venv\\Scripts\\python.exe -m pip install -r requirements.txt
.\\.venv\\Scripts\\python.exe -m uvicorn server:app --host 127.0.0.1 --port 7860
```

Keep the development service bound to loopback. Do not expose it to the LAN or the public internet.

## Model tiers and constraints

| Drishti tier | Checkpoint | License | Local profile |
|---|---|---|---|
| Lite 1.0 | `segmind/SSD-1B` | Apache-2.0 | CUDA recommended; best-effort CPU fallback at 512px |
| Core 1.5 | `black-forest-labs/FLUX.2-klein-4B` | Apache-2.0 | About 13 GB free VRAM recommended |
| Ultra 2.0 | `Qwen/Qwen-Image-2512` | Apache-2.0 | Conservative BF16 profile requires about 60 GB free VRAM |
| X 3.0 MAX | `MiniMaxAI/MiniMax-H3-Image` | MiniMax-H3-Image Community License Agreement | About 70 GB free VRAM on an 80 GB-class GPU and 140 GB free disk; experimental |

The model files are not downloaded during setup. The companion loads only the selected checkpoint when the first generation request is made, then reuses it while the service stays running. Hugging Face's local cache prevents repeat downloads unless files are removed.

**Important license note:** MiniMax-H3-Image is not under Apache-2.0. Read the current license at https://huggingface.co/MiniMaxAI/MiniMax-H3-Image before enabling that tier. Only after independently reviewing and accepting its terms, and confirming your territory is not excluded by the licence, set both `SATYAAI_ACCEPT_MINIMAX_H3_COMMUNITY_LICENSE=1` and `SATYAAI_MINIMAX_H3_TERRITORY_ALLOWED=1` in the local environment before starting the companion. The default is disabled.

## Privacy and network boundary

- Prompts are sent from the browser to `127.0.0.1:7860`, not to SatyaAI's text chat route.
- Generation runs through the local Diffusers/PyTorch process. The app does not forward image prompts to the configured text endpoint.
- The runtime manager and Python packages are downloaded during first-time setup; selected model weights download from their upstream repository on first use.
- The runtime does not expose a network listener to the LAN; it binds to loopback.
- CORS is restricted to SatyaAI's production domains and local development. To use a different trusted deployment origin, set `SATYAAI_ALLOWED_ORIGINS` to a comma-separated allowlist.

## Troubleshooting

- **Companion not installed:** use the one-time Windows installer linked from the Image workspace.
- **Runtime offline:** keep the companion process running in the tray, then press the status recheck in the Image workspace or submit the prompt again.
- **Browser cannot connect:** allow Local Network Access for SatyaAI in Chrome or Edge.
- **Private runtime setup fails:** check the companion log at `%LOCALAPPDATA%\\SatyaAI\\Drishti\\companion.log`, confirm internet access, and retry from the companion window. Python does not need to be installed separately.
- **Model not available:** read the hardware, disk-space and license reason shown by the app. The selector does not override the gate.
- **CUDA out of memory:** use Lite or a machine with more VRAM. The runtime returns an explicit error and does not silently route to a hosted provider.
- **First generation is slow:** the selected model is being downloaded and loaded into the local cache. Later generations reuse the loaded pipeline.
- **Diffusers pipeline class missing:** the companion's next setup check will reconcile missing dependencies; for development, rerun the developer setup above.


## Chakshu local video runtime

The same signed-in Windows companion now serves image generation and the Chakshu video family from the same loopback-only process. SatyaAI sends prompts to `127.0.0.1:7860`; video bytes are returned directly to the browser as an MP4. The Vercel deployment hosts only the interface. Video generation never falls back to a hosted API.

| SatyaAI tier | Upstream weights | Licence | Conservative local hardware gate |
|---|---|---|---|
| Chakshu Light | `Wan-AI/Wan2.1-T2V-1.3B-Diffusers` | Apache-2.0 | NVIDIA CUDA GPU with 9 GB free VRAM, 12 GB available RAM, 15 GB free disk; 480p |
| Chakshu | `Wan-AI/Wan2.2-TI2V-5B-Diffusers` | Apache-2.0 | NVIDIA CUDA GPU with 24 GB free VRAM, 24 GB available RAM, 45 GB free disk; 720p-class output |
| Divya Chakshu 1 | `Lightricks/LTX-2.5-Diffusers` | LTX-2.x Community License | High-memory NVIDIA CUDA workstation with 48 GB free VRAM, 48 GB available RAM, 120 GB free disk; synchronized audio/video |

The app checks free GPU memory, available system RAM, and free cache storage before it attempts to load a video model. The thresholds are deliberately conservative application gates, not universal claims about every quantized or third-party runtime. Light is the smallest tier in this family, but it is not a CPU-only model: integrated graphics and CPU-only laptops will be shown as unsupported rather than silently starting a generation that is unlikely to finish.

Wan2.1 and Wan2.2 model weights are Apache-2.0. LTX-2.5 is open-weight, but its weights are under Lightricks' separate LTX-2.x Community License, not Apache-2.0. Divya Chakshu 1 therefore requires the user to open and acknowledge that model licence in the UI before generation. Review the full terms at the model repository before use.

Model files download only when a tier is first selected for generation and remain in the private Hugging Face cache. Image and video pipelines share the local GPU lock; the companion releases the other pipeline before loading a new tier to avoid deliberately keeping both large models resident at once. Video generation writes an MP4 to a temporary file and streams it back to the browser; the temporary file is removed after transfer.
