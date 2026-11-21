# Drishti

Drishti is SatyaAI's native image-generation engine family. It is a first-party product capability, not a model marketplace. Users see Drishti branding and the four product tiers; upstream checkpoint identifiers are internal runtime metadata.

## Product tiers

| Product name | Tier | Internal checkpoint mapping | Status |
|---|---|---|---|
| Drishti Lite 1.0 | Entry-level | segmind/SSD-1B | Planned |
| Drishti Core 1.5 | Balanced | black-forest-labs/FLUX.2-klein-4B | Planned |
| Drishti Ultra 2.0 | Advanced | Qwen/Qwen-Image-2512 | Planned |
| Drishti X 3.0 MAX | Experimental flagship | MiniMaxAI/MiniMax-H3-Image | Planned |

Only Drishti X 3.0 MAX receives the separate italic **EXPERIMENTAL** treatment in the interface.

## User experience

- Image is a first-class workspace mode, selected from the lower composer tool row alongside Search Web and Research.
- Selecting Image changes the header selector from SatyaSom Reasoning modes to the four Drishti model tiers.
- Selecting Chat restores the existing SatyaSom reasoning selector and preserves its previously selected mode.
- The selected Drishti tier persists locally between visits and is independent of the selected text-reasoning tier.
- Chat history and image workspace state remain separate. Returning to Chat restores the existing conversation.
- The interface does not expose upstream checkpoint names, parameter counts, or technical model identifiers.

## Local-first execution

The intended architecture runs image inference on the end user's own hardware. SatyaAI serves the interface and model metadata; the user's compatible local runtime loads the selected checkpoint and performs generation. A native local companion runtime may be needed for models that cannot be supported reliably inside a browser. Browser-only inference is offered only after a specific model/runtime combination passes compatibility and stability testing.

The client must detect available hardware, check storage and runtime compatibility, download only the selected model, verify downloaded artifacts, cache model files where possible, and provide accurate loading and generation progress. A model selection must never imply that generation is ready before its runtime is connected.

## Current implementation status

The first implementation milestone adds:
1. The Chat/Image workspace mode switch.
2. A mode-aware header selector.
3. Independent, persistent Drishti model selection.
4. The product-facing model registry and capability documentation.
5. An explicit in-development state that prevents the UI from pretending image generation is operational.

Image inference, model downloads, runtime integration, prompt execution, output gallery, image editing, and hardware-based compatibility checks remain subsequent milestones.

## Implementation sequence

1. Workspace mode switching and selector behaviour.
2. Model registry and versioned manifests.
3. Local runtime interface and hardware compatibility detection.
4. Drishti Lite 1.0 integration.
5. Drishti Core 1.5 integration.
6. Drishti Ultra 2.0 integration.
7. Drishti X 3.0 MAX experimental integration.
8. Image history, gallery, export, and editing workflows.
