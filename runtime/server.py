from __future__ import annotations

import base64
import gc
import io
import os
import secrets
import shutil
import threading
import time
from pathlib import Path
from typing import Literal

import diffusers
import psutil
import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from PIL import Image

SERVICE_VERSION = "0.1.0"
MODEL_IDS = ("lite", "core", "ultra", "max")
MODEL_INFO = {
    "lite": {
        "repo": "segmind/SSD-1B",
        "license": "Apache-2.0",
        "hardware": "CUDA GPU recommended; CPU mode is best-effort and limited to 512px.",
        "disk_gb": 8,
    },
    "core": {
        "repo": "black-forest-labs/FLUX.2-klein-4B",
        "license": "Apache-2.0",
        "hardware": "NVIDIA GPU with about 13 GB or more free VRAM recommended.",
        "disk_gb": 16,
    },
    "ultra": {
        "repo": "Qwen/Qwen-Image-2512",
        "license": "Apache-2.0",
        "hardware": "High-memory accelerator; an upstream BF16 serving benchmark reports about 59 GiB peak VRAM.",
        "disk_gb": 60,
    },
    "max": {
        "repo": "MiniMaxAI/MiniMax-H3-Image",
        "license": "MiniMax-H3-Image Community License Agreement",
        "hardware": "About 70 GB free VRAM on an 80 GB-class GPU and at least 140 GB free disk, plus explicit licence and territory acknowledgement.",
        "disk_gb": 140,
    },
}

app = FastAPI(
    title="SatyaAI Drishti Local Runtime",
    version=SERVICE_VERSION,
    docs_url=None,
    redoc_url=None,
)

allowed_origins = [
    item.strip()
    for item in os.getenv(
        "SATYAAI_ALLOWED_ORIGINS",
        ",".join(
            [
                "https://satyaai-five.vercel.app",
                "https://satyaai-teamsatyajitbeura.vercel.app",
                "https://satyaai-git-main-teamsatyajitbeura.vercel.app",
                "http://localhost:5173",
                "http://127.0.0.1:5173",
            ]
        ),
    ).split(",")
    if item.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Accept", "Content-Type", "X-SatyaAI-Client"],
)


_pipeline = None
_loaded_model: str | None = None
_generation_lock = threading.Lock()

_runtime_state = {
    "phase": "idle",
    "message": "Ready for a local image request.",
    "progress": 0,
    "step": 0,
    "total_steps": 0,
    "model_id": None,
}


def _set_runtime_state(
    phase: str,
    message: str,
    progress: int | None = None,
    step: int = 0,
    total_steps: int = 0,
    model_id: str | None = None,
) -> None:
    _runtime_state.update({
        "phase": phase,
        "message": message,
        "progress": progress,
        "step": step,
        "total_steps": total_steps,
        "model_id": model_id,
    })


@app.get("/v1/status")
def runtime_status():
    return {
        **_runtime_state,
        "busy": _generation_lock.locked(),
        "loaded_model": _loaded_model,
    }


def _disk_root() -> Path:
    configured = os.getenv("HF_HOME")
    return Path(configured).expanduser() if configured else Path.home() / ".cache" / "huggingface"


def _free_disk_gb() -> float:
    root = _disk_root()
    root.mkdir(parents=True, exist_ok=True)
    return shutil.disk_usage(root).free / (1024 ** 3)


def _gpu_stats() -> tuple[float | None, float | None, str | None]:
    if not torch.cuda.is_available():
        return None, None, None
    try:
        free_bytes, total_bytes = torch.cuda.mem_get_info()
        name = torch.cuda.get_device_name(0)
        return total_bytes / (1024 ** 3), free_bytes / (1024 ** 3), name
    except Exception:
        return None, None, torch.cuda.get_device_name(0)


def _model_availability(
    model_id: str,
    device: str,
    vram_total: float | None,
    vram_free: float | None,
    ram_available: float,
    free_disk: float,
) -> dict:
    info = MODEL_INFO[model_id]
    if free_disk < info["disk_gb"]:
        return {
            "available": False,
            "reason": f"Not enough free disk space in the Hugging Face cache. At least {info['disk_gb']} GB is reserved for this model.",
            "license": info["license"],
            "recommended_hardware": info["hardware"],
        }

    if model_id == "lite":
        if device == "cuda" and (vram_free or 0) >= 5:
            reason = "Compatible CUDA device detected. The model downloads only when first selected for generation."
            available = True
        elif device == "cpu" and ram_available >= 12:
            reason = "CPU mode is available as a best-effort fallback. Expect slow generation; output is limited to 512px."
            available = True
        else:
            reason = "Drishti Lite needs a CUDA device with roughly 5 GB free VRAM, or at least 12 GB currently available system RAM for the slow CPU fallback."
            available = False
    elif model_id == "core":
        available = device == "cuda" and (vram_free or 0) >= 13
        reason = (
            "Compatible CUDA memory detected. The model downloads only when first selected."
            if available
            else "Drishti Core requires an NVIDIA CUDA GPU with about 13 GB or more free VRAM. CPU-only laptops are not suitable for this tier."
        )
    elif model_id == "ultra":
        available = device == "cuda" and (vram_free or 0) >= 60
        reason = (
            "High-memory CUDA device detected. The full BF16 pipeline is enabled."
            if available
            else "Drishti Ultra uses a 20B-parameter BF16 model. The conservative local profile requires about 60 GB free VRAM; this is not a normal laptop model."
        )
    else:
        license_accepted = (
            os.getenv("SATYAAI_ACCEPT_MINIMAX_H3_COMMUNITY_LICENSE") == "1"
            and os.getenv("SATYAAI_MINIMAX_H3_TERRITORY_ALLOWED") == "1"
        )
        available = (
            device == "cuda"
            and (vram_free or 0) >= 70
            and torch.cuda.is_bf16_supported()
            and license_accepted
        )
        if not license_accepted:
            reason = "This checkpoint is under the MiniMax-H3-Image Community License Agreement, not Apache-2.0. Review the complete licence, confirm your territory is not excluded, then set both SATYAAI_ACCEPT_MINIMAX_H3_COMMUNITY_LICENSE=1 and SATYAAI_MINIMAX_H3_TERRITORY_ALLOWED=1."
        elif device != "cuda" or (vram_free or 0) < 70 or not torch.cuda.is_bf16_supported():
            reason = "Drishti X uses a 33.1B-parameter image transformer and a separate 66.7 GB text encoder. The official Diffusers example uses automatic component offloading and reports about 65 GB peak GPU memory; this local profile requires BF16 support and about 70 GB free VRAM."
        else:
            reason = "License acknowledgement and high-memory CUDA hardware detected. The model will download only when first selected."
    return {
        "available": available,
        "reason": reason,
        "license": info["license"],
        "recommended_hardware": info["hardware"],
    }


def _health_payload() -> dict:
    device = "cuda" if torch.cuda.is_available() else "cpu"
    vram_total, vram_free, device_name = _gpu_stats()
    ram_available = psutil.virtual_memory().available / (1024 ** 3)
    free_disk = _free_disk_gb()
    models = {
        model_id: _model_availability(
            model_id, device, vram_total, vram_free, ram_available, free_disk
        )
        for model_id in MODEL_IDS
    }
    return {
        "ok": True,
        "service": "satyaai-drishti-runtime",
        "version": SERVICE_VERSION,
        "device": device,
        "device_name": device_name,
        "vram_total_gb": round(vram_total, 1) if vram_total is not None else None,
        "vram_free_gb": round(vram_free, 1) if vram_free is not None else None,
        "ram_available_gb": round(ram_available, 1),
        "free_disk_gb": round(free_disk, 1),
        "loaded_model": _loaded_model,
        "busy": _generation_lock.locked(),
        "models": models,
    }


@app.get("/health")
def health():
    try:
        return _health_payload()
    except Exception as error:
        raise HTTPException(status_code=503, detail=f"Runtime health check failed: {error}") from error


class GenerateRequest(BaseModel):
    model_id: Literal["lite", "core", "ultra", "max"]
    prompt: str = Field(min_length=1, max_length=4000)
    width: int = Field(default=512, ge=256, le=1024)
    height: int = Field(default=512, ge=256, le=1024)


def _release_pipeline() -> None:
    global _pipeline, _loaded_model
    old = _pipeline
    _pipeline = None
    _loaded_model = None
    del old
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()


def _load_pipeline(model_id: str):
    global _pipeline, _loaded_model
    if _pipeline is not None and _loaded_model == model_id:
        return _pipeline

    _release_pipeline()
    use_cuda = torch.cuda.is_available()
    dtype = (
        torch.bfloat16
        if use_cuda and torch.cuda.is_bf16_supported()
        else torch.float16 if use_cuda else torch.float32
    )
    repo = MODEL_INFO[model_id]["repo"]
    common = {"torch_dtype": dtype, "low_cpu_mem_usage": True}

    if model_id == "lite":
        kwargs = {**common, "use_safetensors": True}
        if use_cuda:
            kwargs["variant"] = "fp16"
        pipeline = diffusers.StableDiffusionXLPipeline.from_pretrained(repo, **kwargs)
        if use_cuda:
            pipeline.to("cuda")
        elif hasattr(pipeline, "enable_attention_slicing"):
            pipeline.enable_attention_slicing()
    elif model_id == "core":
        pipeline_type = getattr(diffusers, "Flux2KleinPipeline", None)
        if pipeline_type is None:
            raise RuntimeError("Update the local Diffusers installation; Flux2KleinPipeline is unavailable.")
        pipeline = pipeline_type.from_pretrained(repo, **common)
        if use_cuda and hasattr(pipeline, "enable_model_cpu_offload"):
            pipeline.enable_model_cpu_offload()
        else:
            pipeline.to("cpu")
    elif model_id == "ultra":
        pipeline_type = getattr(diffusers, "QwenImagePipeline", None)
        if pipeline_type is None:
            raise RuntimeError("Update the local Diffusers installation; QwenImagePipeline is unavailable.")
        pipeline = pipeline_type.from_pretrained(repo, **common)
        pipeline.to("cuda")
    else:
        components_manager_type = getattr(diffusers, "ComponentsManager", None)
        modular_pipeline_type = getattr(diffusers, "ModularPipeline", None)
        if components_manager_type is None or modular_pipeline_type is None:
            raise RuntimeError("Update the local Diffusers installation; MiniMax H3 Image modular components are unavailable.")
        manager = components_manager_type()
        manager.enable_auto_cpu_offload(device="cuda")
        pipeline = modular_pipeline_type.from_pretrained(repo, components_manager=manager)
        pipeline.load_components(dtype=torch.bfloat16)

    _pipeline = pipeline
    _loaded_model = model_id
    return pipeline


@app.post("/v1/generate")
def generate(request: GenerateRequest):
    global _pipeline, _loaded_model
    prompt = request.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=422, detail="Write an image prompt first.")

    if not _generation_lock.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="Another Drishti generation is already running on this device.")

    started = time.perf_counter()
    try:
        _set_runtime_state(
            "checking",
            "Checking local hardware and model eligibility…",
            0,
            model_id=request.model_id,
        )
        health_snapshot = _health_payload()
        availability = health_snapshot["models"][request.model_id]
        if not availability["available"]:
            raise HTTPException(status_code=409, detail=availability["reason"])

        width, height = request.width, request.height
        if health_snapshot["device"] == "cpu" and (width > 512 or height > 512):
            raise HTTPException(status_code=400, detail="CPU generation is limited to 512 × 512 pixels.")

        already_loaded = _pipeline is not None and _loaded_model == request.model_id
        if not already_loaded:
            _set_runtime_state(
                "loading_model",
                "Downloading model files if needed, then loading the selected Drishti model. First use can take a while.",
                None,
                model_id=request.model_id,
            )
        pipeline = _load_pipeline(request.model_id)
        steps = {"lite": 30, "core": 4, "ultra": 50}.get(request.model_id)
        _set_runtime_state(
            "generating",
            "Generating your image locally…",
            0,
            0,
            steps or 0,
            request.model_id,
        )

        seed = secrets.randbelow(2**31)
        generator_device = "cuda" if torch.cuda.is_available() else "cpu"
        generator = torch.Generator(device=generator_device).manual_seed(seed)

        def report_step_end(pipe, step: int, timestep: int, callback_kwargs: dict):
            total = max(steps or 1, 1)
            current = step + 1
            _set_runtime_state(
                "generating",
                f"Generating image locally… Step {current} of {total}",
                min(99, int((current / total) * 100)),
                current,
                total,
                request.model_id,
            )
            return callback_kwargs

        with torch.inference_mode():
            call_args = {
                "prompt": prompt,
                "width": width,
                "height": height,
                "num_inference_steps": steps or 6,
                "generator": generator,
            }
            if request.model_id == "lite":
                call_args["guidance_scale"] = 9.0
                call_args["negative_prompt"] = "low quality, blurry, distorted, malformed anatomy, artifacts"
            elif request.model_id == "core":
                call_args["guidance_scale"] = 1.0

            if request.model_id == "max":
                output = pipeline(
                    prompt=prompt,
                    width=width,
                    height=height,
                    generator=generator,
                    output="images",
                    min_generation_area=1024,
                )
                image: Image.Image = output[0]
            else:
                call_args["callback_on_step_end"] = report_step_end
                output = pipeline(**call_args)
                image = output.images[0]

        buffer = io.BytesIO()
        image.save(buffer, format="PNG", optimize=True)
        encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
        elapsed = round(time.perf_counter() - started, 2)
        _set_runtime_state(
            "complete",
            f"Image generated in {elapsed} seconds.",
            100,
            steps or 6,
            steps or 6,
            request.model_id,
        )
        return {
            "image_data_url": "data:image/png;base64," + encoded,
            "model_id": request.model_id,
            "elapsed_seconds": elapsed,
            "seed": seed,
        }
    except HTTPException as error:
        _set_runtime_state("error", str(error.detail), None, model_id=request.model_id)
        raise
    except torch.cuda.OutOfMemoryError as error:
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        message = "The selected model exceeded available GPU memory. Choose a smaller Drishti tier or use a machine with more VRAM."
        _set_runtime_state("error", message, None, model_id=request.model_id)
        raise HTTPException(status_code=507, detail=message) from error
    except Exception as error:
        message = f"Drishti could not generate this image: {type(error).__name__}: {error}"
        _set_runtime_state("error", message, None, model_id=request.model_id)
        raise HTTPException(status_code=500, detail=message) from error
    finally:
        _generation_lock.release()
