// ---- 3D entity types -------------------------------------------------------
export * from "./empty.ts";

// Renderer-backed
export * from "./mesh.ts";
export * from "./point-light.ts";
export * from "./directional-light.ts";
export * from "./spot-light.ts";
export * from "./ambient-light.ts";
export * from "./camera.ts";

// Physics-backed (Collider before CharacterController)
export * from "./rigidbody.ts";
export * from "./collider.ts";
export * from "./character-controller.ts";

// Audio-backed
export * from "./audio-source.ts";

// UI stubs (2D PIXI removed; HTML/CSS replacement in future)
export * from "./ui-layer.ts";
export * from "./ui-panel.ts";
