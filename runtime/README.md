# Drishti local companion runtime

This companion is the image-inference process used by SatyaAI's Image workspace. The Vercel deployment serves the UI only. Model weights are downloaded to this computer's Hugging Face cache, and generation runs on this computer. The service binds to `127.0.0.1` only; it is not a public API.

## Requirements

- Python 3.10 or newer.
- A supported PyTorch installation.
- Free disk space for the selected model.
- A recent Chrome or Edge browser when using the hosted SatyaAI interface.
- NVIDIA CUDA hardware for Core, Ultra and X. Lite has a best-effort CPU fallback, but CPU generation can be very slow.

## Windows setup

1. Download or clone the SatyaAI repository.
2. Create the runtime virtual environment: `python -m venv .venv`.
3. Install PyTorch in `runtime\.venv` using the official selector at https://pytorch.org/get-started/locally/. Choose the CPU build for CPU-only systems, or the matching CUDA build for a supported NVIDIA GPU.
4. Open PowerShell in the repository's `runtime` folder.
5. Install the companion dependencies and start the server:

```powershell
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn server:app --host 127.0.0.1 --port 7860
```

The `start.ps1` launcher can be used after PyTorch is installed in the runtime virtual environment.

6. Keep the runtime window open and return to SatyaAI Image mode. The app checks `http://127.0.0.1:7860/health` and enables Generate only when the selected model passes the local hardware check.

For a GPU installation, use the exact command produced by the PyTorch selector instead of the CPU example above. Do not install a random CUDA wheel.

## Model tiers and constraints

| Drishti tier | Checkpoint | License | Local profile |
|---|---|---|---|
| Lite 1.0 | `segmind/SSD-1B` | Apache-2.0 | CUDA recommended; best-effort CPU fallback at 512px |
| Core 1.5 | `black-forest-labs/FLUX.2-klein-4B` | Apache-2.0 | About 13 GB free VRAM recommended |
| Ultra 2.0 | `Qwen/Qwen-Image-2512` | Apache-2.0 | Conservative BF16 profile requires about 60 GB free VRAM |
| X 3.0 MAX | `MiniMaxAI/MiniMax-H3-Image` | MiniMax-H3-Image Community License Agreement | About 70 GB free VRAM on an 80 GB-class GPU and 140 GB free disk; experimental |

The model files are not downloaded during setup. The companion loads only the selected checkpoint when the first generation request is made, then reuses it while the service stays running. Hugging Face's local cache prevents repeat downloads unless files are removed.

**Important license note:** MiniMax-H3-Image is not under Apache-2.0. Read the current license at https://huggingface.co/MiniMaxAI/MiniMax-H3-Image before enabling that tier. Only after independently reviewing and accepting its terms, and confirming your territory is not excluded by the licence, set both `SATYAAI_ACCEPT_MINIMAX_H3_COMMUNITY_LICENSE=1` and `SATYAAI_MINIMAX_H3_TERRITORY_ALLOWED=1` in the local environment before starting the companion. The official Diffusers modular implementation uses automatic component offloading and documents about 65 GB peak VRAM; the runtime gate reserves about 70 GB free VRAM. The default is disabled.

## Privacy and network boundary

- Prompts are sent from the browser to `127.0.0.1:7860`, not to SatyaAI's text chat route.
- Generation runs through the local Diffusers/PyTorch process. The app does not forward image prompts to the configured text endpoint.
- The only model downloads are from the selected model's upstream repository on first use.
- The runtime does not expose a network listener to the LAN; it binds to loopback.
- CORS is restricted to SatyaAI's production domains and local development. To use a different trusted deployment origin, set `SATYAAI_ALLOWED_ORIGINS` to a comma-separated allowlist.

## Troubleshooting

- **Runtime offline:** keep the companion process running and press the status recheck in the Image workspace.
- **Model not available:** read the hardware, disk-space and license reason shown by the app. The selector does not override the gate.
- **CUDA out of memory:** use Lite or a machine with more VRAM. The runtime returns an explicit error and does not silently route to a hosted provider.
- **First generation is slow:** the selected model is being downloaded and loaded into the local cache. Later generations reuse the loaded pipeline.
- **Diffusers pipeline class missing:** update dependencies with `pip install -r requirements.txt` in the runtime virtual environment.