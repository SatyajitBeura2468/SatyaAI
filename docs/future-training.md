# SatyaSom Engine and future training

SatyaSom Engine is SatyaAI's shared model-engine platform. It is not itself a foundation model or a checkpoint.

SatyaAI's product model family is organised into four workload-specific tiers: Anu (Nano), Indu (Fast), Dhara (Smart), and Aditya (Deep Think). Each tier has its own model configuration, parameter scale, and generation settings for its intended use case, while remaining part of the same SatyaSom Engine ecosystem.

**Current repository boundary:** this codebase does not train or download model weights. Its inference layer points to pre-existing model checkpoints. Smart and Deep Think currently share the same configured 3B checkpoint, but use different generation settings. No claim should be made that the deployed checkpoints were trained from scratch inside SatyaSom Engine.

A future SatyaSom training pipeline can make training provenance verifiable by recording datasets, tokenizer, architecture, parameter counts, training runs, optimisation stages, evaluation results, checkpoints, and release artefacts. A possible path is curated SatyaAI data → supervised fine-tuning → parameter-efficient tuning → preference/reasoning optimisation → evaluation → release.
