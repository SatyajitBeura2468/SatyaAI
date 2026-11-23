# Model notices

SatyaSom Engine is the product identity and application-level architecture of SatyaAI. The local model weights used by the current release are separately licensed components selected by tier.

## Required attribution

**Built with Llama.**

The Fast, Smart, and Deep text tiers currently use Llama 3.2 model weights. This notice is retained to satisfy the Llama 3.2 Community License attribution requirement. The phrase identifies a licensed model component; SatyaSom Engine remains the SatyaAI product and orchestration identity.

Read the [Llama 3.2 Community License](https://dev.meta.ai/llama/llama3_2/license) and its applicable acceptable-use terms before redistributing or making model materials available.

## Kaṇa (Nano) model notice

Kaṇa is a separate 135M-parameter tier using the SmolLM2-135M-Instruct ONNX conversion published by ONNX Community. SatyaAI selects the INT8 ONNX checkpoint and runs it through Transformers.js on WebAssembly CPU. Preserve the upstream SmolLM2 attribution and applicable Apache-2.0 licence notice. The product-facing identity remains Kaṇa; SatyaAI does not claim that the upstream pretrained weights were trained from scratch by the project.

Model repository: https://huggingface.co/onnx-community/SmolLM2-135M-Instruct-ONNX-MHA

## Current product boundary

The Kaṇa, Anu, Indu, Dhara, and Aditya names are SatyaAI's user-facing tiers. The model configuration and generation runtime are implementation components; they do not change the product's name or identity.

Image and video generation use the separately installed local companion. Each selected model has its own hardware and licence requirements, shown in the relevant workspace and documented in [the local runtime guide](../runtime/README.md).
