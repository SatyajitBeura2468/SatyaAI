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
