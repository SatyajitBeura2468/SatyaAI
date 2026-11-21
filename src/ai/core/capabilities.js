export const CAPABILITY_STATUS = Object.freeze({
  AVAILABLE: "AVAILABLE",
  IN_DEVELOPMENT: "IN_DEVELOPMENT",
  PLANNED: "PLANNED",
  UNAVAILABLE: "UNAVAILABLE",
});

export const CAPABILITIES = Object.freeze([
  Object.freeze({
    id: "conversational-intelligence",
    name: "Conversational intelligence",
    status: CAPABILITY_STATUS.AVAILABLE,
    details: "Nano, Fast, Smart, and Deep Think are application-level modes. Nano uses lightweight browser-local inference; the other modes follow trusted provider configuration.",
  }),
  Object.freeze({
    id: "web-search",
    name: "Web search",
    status: CAPABILITY_STATUS.IN_DEVELOPMENT,
    details: "Current online information retrieval is not presented as operational in this baseline.",
  }),
  Object.freeze({
    id: "deep-research",
    name: "Deep research",
    status: CAPABILITY_STATUS.IN_DEVELOPMENT,
    details: "Multi-stage research and evidence synthesis are in development.",
  }),
  Object.freeze({
    id: "image-creation",
    name: "Image creation",
    status: CAPABILITY_STATUS.IN_DEVELOPMENT,
    details: "The frontend-to-local-companion request path and Diffusers service are implemented. A model can generate only after the companion is installed on the user device, the selected checkpoint passes local hardware/license checks, and the actual Diffusers pipeline successfully loads.",
  }),
  Object.freeze({
    id: "local-inference",
    name: "Local inference",
    status: CAPABILITY_STATUS.AVAILABLE,
    details: "Conditional on browser WebGPU support, compatible models, available hardware resources, and successful initialization.",
  }),
  Object.freeze({
    id: "remote-inference",
    name: "Remote inference",
    status: CAPABILITY_STATUS.AVAILABLE,
    details: "Conditional on a configured, reachable remote inference endpoint. A remote route is not local execution.",
  }),
  Object.freeze({
    id: "text-file-attachments",
    name: "Text-file attachments",
    status: CAPABILITY_STATUS.AVAILABLE,
    details: "The current interface accepts supported text formats and passes their text content as conversation context; this is not general document, image, or video understanding.",
  }),
]);

export function capabilityById(id) {
  return CAPABILITIES.find((item) => item.id === id) ?? null;
}