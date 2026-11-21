$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path ".venv")) {
    python -m venv .venv
}

$python = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
    throw "Python 3.10+ was not found. Install Python and run this script again."
}

& $python -c "import torch" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "PyTorch is not installed in runtime\.venv."
    Write-Host "Install the correct PyTorch build for your CPU or NVIDIA CUDA setup first:"
    Write-Host "https://pytorch.org/get-started/locally/"
    exit 1
}

& $python -m pip install --upgrade pip
& $python -m pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) {
    throw "Dependency installation failed."
}

Write-Host ""
Write-Host "Starting the Drishti local image runtime at http://127.0.0.1:7860"
Write-Host "Keep this PowerShell window open while using SatyaAI Image mode."
& $python -m uvicorn server:app --host 127.0.0.1 --port 7860
