# SatyaSom Engine Architecture

SatyaAI's model family is built on the **SatyaSom Engine Architecture**, designed and developed from scratch for the SatyaAI ecosystem.

SatyaSom Engine is the shared architecture and engine framework. It is not one single foundation model, checkpoint, or tier. There is no universal foundational model shared across the four variants.

## Model family

The architecture includes four purpose-built model variants:

- **Anu (Nano):** lightweight, resource-conscious reasoning.
- **Indu (Fast):** responsive general-purpose reasoning.
- **Dhara (Smart):** balanced reasoning, quality, and capability.
- **Aditya (Deep Think):** extended reasoning and larger generation budgets.

Each variant is designed for its own workload, with its own model scale, parameter configuration, generation settings, capabilities, and use cases. All four remain part of the same SatyaSom Engine Architecture.

## Runtime artifact alignment

The current provider configuration still contains legacy WebLLM checkpoint identifiers. These should be treated strictly as inference-loader references, not as SatyaAI's public model identity. The provider layer must be migrated to the corresponding SatyaSom-built artifacts and configurations to make the live runtime fully match the from-scratch architecture.

Maintain a verified registry for each SatyaSom variant: architecture version, parameter count, model artifact, tokenizer/configuration, intended use cases, capability profile, and evaluation results. Do not invent exact parameter counts or benchmark claims when they are not in the registry.
