<div align="center">

# SatyaAI

### Private, Multi-Modal Intelligence Powered by the Satya Som Engine

**Think, create, and generate right on your own device. Zero cloud bills. Zero data tracking. Pure local intelligence.**

[![Launch SatyaAI](https://img.shields.io/badge/Launch_App-SatyaAI_Web-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://satyaai-five.vercel.app)
[![Engine](https://img.shields.io/badge/Core-Satya_Som_Engine-4F46E5?style=for-the-badge)](#the-satya-som-engine)
[![Privacy](https://img.shields.io/badge/Privacy-100%25_Local_First-10B981?style=for-the-badge)](#privacy-by-architecture)
[![Platform](https://img.shields.io/badge/Desktop-Windows_Companion-0078D6?style=for-the-badge&logo=windows&logoColor=white)](#drishti-companion-for-windows)

</div>

---

## Intelligence That Belongs to You

Modern AI expects you to rent your intelligence: pay monthly subscriptions, send your private thoughts to remote servers, and wait in cloud queues.

**SatyaAI flips the model.** Built from the ground up on the custom **Satya Som Engine**, SatyaAI is a unified, local-first AI workspace that brings conversational reasoning, image synthesis, and video creation straight to your browser and desktop hardware.

No API keys. No account walls. No remote prompt logging. Just open the studio and create.

---

## What You Can Do Inside SatyaAI

* **Adaptive Reasoning Studio:** Switch effortlessly across five custom-tuned Satya Som intelligence tiers, from instant CPU responses on everyday laptops to deep multi-step reasoning on GPU-equipped machines.
* **Drishti 2.0 (Image Studio):** Generate high-detail visuals locally through a dedicated, privately managed local creative runtime with real-time progress and cancellation controls.
* **Chakshu (Video Studio):** Turn prompts into local motion clips with a built-in session history strip and instant playback controls.
* **Deep Research (Preview):** An upcoming multi-stage synthesis workspace designed to break down complex questions into structured, verifiable insights.
* **Guided by SATYA CORE:** Every text interaction is shaped by our proprietary **SATYA CORE** persona and reasoning framework for clear, direct, and grounded answers.

---

## The Satya Som Engine

Unlike one-size-fits-all cloud chatbots, the **Satya Som Engine** scales to the exact hardware in front of you. Pick the tier that matches your task and your machine:

| Tier | Symbol | Scale | Best For | Execution Runtime |
| :--- | :---: | :--- | :--- | :--- |
| **Kaṇa** | `·` | Nano | Instant answers, quick edits, everyday laptops | Browser-local CPU (ONNX / WebAssembly, no GPU required) |
| **Anu** | `⚛` | Micro | Snappy daily chat and lightweight drafting | Browser-local WebGPU |
| **Indu** | `☽` | Fast | Balanced speed, summaries, and coding help | Browser-local WebGPU |
| **Dhara** | `◈` | Smart | Complex problem solving and structured writing | Browser-local WebGPU |
| **Aditya** | `☀` | Deep Think | High-depth reasoning, analysis, and multi-step logic | Browser-local WebGPU |

> **Hardware Note:** **Kaṇa** is engineered to run directly on standard CPUs via WebAssembly with zero WebGPU requirement. **Anu**, **Indu**, **Dhara**, and **Aditya** automatically unlock hardware acceleration on browsers with WebGPU support.

---

## Drishti Companion for Windows

Heavy creative workloads deserve desktop-grade power without forcing users into command lines or Python configuration headaches.

**SatyaAI Drishti Companion** is a lightweight native Windows desktop bridge built specifically for the Satya Som ecosystem:

1. **One-Click Setup:** Automatically provisions an isolated local runtime environment behind the scenes.
2. **Smart Hardware Detection:** Automatically selects the optimal compute path for your system.
3. **Auto-Startup Ready:** Quietly runs on `127.0.0.1:7860` so the web studio connects to your local creative engine the moment you open Drishti 2.0.
4. **Locked-Down Local Bridge:** Strict origin policies ensure only trusted SatyaAI studio sessions can communicate with your local runtime.

---

## Privacy by Architecture

Privacy in SatyaAI is not a checkbox in a settings menu. It is how the software is wired:

* **Browser-Native Execution:** All Satya Som text tiers run inside your browser sandbox. Once cached locally, your conversations stay on your machine.
* **Localhost Creative Runtime:** Drishti 2.0 and Chakshu render directly on your computer rather than uploading prompts or media to third-party render farms.
* **Zero Telemetry:** No tracking pixels, no prompt harvesting, and no silent cloud fallbacks.

---

## Start Using SatyaAI

1. Open the live web studio at **[satyaai-five.vercel.app](https://satyaai-five.vercel.app)**.
2. Choose **Kaṇa** for instant CPU-ready chat, or select a higher **Satya Som** tier if your browser supports WebGPU.
3. Ready for local image generation? Install the **SatyaAI Drishti Companion** on Windows, launch it once, and switch to the **Drishti 2.0** tab in the studio.

---

## Roadmap

* [x] Five-tier Satya Som local reasoning ladder (`Kaṇa` through `Aditya`)
* [x] Zero-GPU CPU/WASM execution via `Kaṇa`
* [x] **Drishti 2.0** local image studio and native Windows Companion installer
* [x] **Chakshu** local video generation studio with session history
* [ ] **Deep Research:** Full multi-step local research and citation workflow
* [ ] **Smriti Vault:** 100% private in-browser document memory for PDFs and personal notes
* [ ] **Live Telemetry HUD:** Real-time tokens/sec, memory footprint, and active accelerator badges

---

<details>
<summary><strong>Want to tinker or run SatyaAI locally? (Quick Dev Setup)</strong></summary>

If you want to explore the codebase, tweak the studio UI, or contribute to the Satya Som Engine, getting up and running takes under a minute.

**Prerequisites:** Node.js (v20+) and `pnpm`.

```bash
# 1. Clone the repository
git clone [https://github.com/SatyajitBeura2468/SatyaAI.git](https://github.com/SatyajitBeura2468/SatyaAI.git)
cd SatyaAI

# 2. Install dependencies
pnpm install

# 3. Start the local studio
pnpm dev
```

Useful scripts when making changes:

```bash
pnpm test     # Run unit tests
pnpm build    # Create a production build
```

For the local creative engine, launch the Windows Companion (`SatyaAI.Drishti.Companion`) or run the local Python runtime on `http://127.0.0.1:7860`.

</details>

---

<div align="center">

### A SatyaSom Creation

Designed and engineered by **Satyajit Beura** and **Gourav Beura** under **Beura Labs** and **SatyaSom**.

[GitHub](https://github.com/SatyajitBeura2468) · [Portfolio & Research Hub](https://satyajitbeura2468.github.io) · [Live Studio](https://satyaai-five.vercel.app)

</div>
