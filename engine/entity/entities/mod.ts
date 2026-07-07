// ---- 3D entity types -------------------------------------------------------
export * from "./empty.ts";
export * from "./clickable.ts";

// Renderer-backed
export * from "./mesh.ts";
export * from "./sprite.ts";
export * from "./tiling-sprite.ts";
export * from "./animated-sprite.ts";
export * from "./colored-square.ts";
export * from "./solid-color.ts";
export * from "./colored-polygon.ts";
export * from "./vector-sprite.ts";
export * from "./rich-text.ts";
export * from "./render-container.ts";

// Lights
export * from "./point-light.ts";
export * from "./directional-light.ts";
export * from "./spot-light.ts";
export * from "./ambient-light.ts";

// Camera
export * from "./camera.ts";

// Physics-backed
export * from "./rigidbody.ts";
export * from "./collider.ts";
export * from "./complex-collider.ts";
export * from "./character-controller.ts";

// Audio-backed
export * from "./audio-source.ts";

// UI (HTML/CSS overlay)
export * from "./ui-layer.ts";
export * from "./ui-panel.ts";

// Editor-only helpers (bounds debug etc.)
export * from "./bounds-debug.ts";
