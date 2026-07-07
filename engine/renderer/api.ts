import type { IVec3 } from "../math/vec3.ts";
import type { IQuat } from "../math/quat.ts";

// ---------------------------------------------------------------------------
// Opaque handle types
// ---------------------------------------------------------------------------
export type MeshHandle = number & { readonly _brand: "MeshHandle" };
export type LightHandle = number & { readonly _brand: "LightHandle" };
export type CameraHandle = number & { readonly _brand: "CameraHandle" };
export type HelperHandle = number & { readonly _brand: "HelperHandle" };

// ---------------------------------------------------------------------------
// Descriptor types
// ---------------------------------------------------------------------------
export type GeometryDesc =
  | { type: "box"; width: number; height: number; depth: number }
  | { type: "sphere"; radius: number; segments?: number }
  | { type: "capsule"; radius: number; height: number; segments?: number }
  | { type: "cylinder"; radiusTop: number; radiusBottom: number; height: number; segments?: number }
  | { type: "cone"; radius: number; height: number; segments?: number }
  | { type: "plane"; width: number; height: number }
  | { type: "polygon"; sides: number; width: number; height: number }
  | { type: "gltf"; url: string };

export interface MaterialDesc {
  type?: "standard" | "unlit";
  /** Hex number (0xRRGGBB) or CSS color string ("white", "#ff0000"). */
  color?: number | string;
  texture?: string;
  roughness?: number;
  metalness?: number;
  emissive?: number | string;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  wireframe?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  /** Alpha cutoff — fragments below this opacity are discarded. Good for textures with transparency. */
  alphaTest?: number;
  /** Which face(s) to render. "double" is needed for flat planes viewed from both sides. Default: "front". */
  side?: "front" | "double" | "back";
  /** UV tiling repeat (texture wraps this many times). */
  uvRepeat?: { x: number; y: number };
  /** UV scroll offset (0-1 range per axis). */
  uvOffset?: { x: number; y: number };
}

export type LightDesc =
  | { type: "ambient"; color: number; intensity: number }
  | { type: "hemisphere"; skyColor: number; groundColor: number; intensity: number }
  | { type: "directional"; color: number; intensity: number; castShadow?: boolean }
  | { type: "point"; color: number; intensity: number; distance?: number; decay?: number }
  | { type: "spot"; color: number; intensity: number; angle: number; penumbra?: number; distance?: number; decay?: number };

export interface CameraDesc {
  fov?: number;
  near?: number;
  far?: number;
}

// ---------------------------------------------------------------------------
// The contract every renderer backend must fulfill.
// ---------------------------------------------------------------------------
export interface IRendererBackend {
  readonly canvas: HTMLCanvasElement;

  // ---- Frame -------------------------------------------------------------
  render(): void;
  /** Resize the drawing buffer; with no numeric args, measures the container. */
  resize(width?: number | boolean, height?: number): void;
  setPixelRatio(ratio: number): void;

  // ---- Meshes ------------------------------------------------------------
  createMesh(entityRef: string, geometry: GeometryDesc, material: MaterialDesc): MeshHandle;
  destroyMesh(handle: MeshHandle): void;
  setMeshTransform(handle: MeshHandle, pos: IVec3, rot: IQuat, scale: IVec3): void;
  setMeshVisible(handle: MeshHandle, visible: boolean): void;
  updateMeshGeometry(handle: MeshHandle, geometry: GeometryDesc): void;
  updateMeshMaterial(handle: MeshHandle, material: Partial<MaterialDesc>): void;

  // ---- Lights ------------------------------------------------------------
  createLight(entityRef: string, desc: LightDesc): LightHandle;
  destroyLight(handle: LightHandle): void;
  setLightTransform(handle: LightHandle, pos: IVec3, rot: IQuat): void;
  setLightVisible(handle: LightHandle, visible: boolean): void;
  updateLight(handle: LightHandle, desc: Partial<LightDesc>): void;

  // ---- Cameras -----------------------------------------------------------
  createCamera(entityRef: string, desc: CameraDesc): CameraHandle;
  destroyCamera(handle: CameraHandle): void;
  setCameraTransform(handle: CameraHandle, pos: IVec3, rot: IQuat): void;
  setActiveCamera(handle: CameraHandle): void;
  getActiveCameraHandle(): CameraHandle | undefined;
  updateCamera(handle: CameraHandle, desc: Partial<CameraDesc>): void;

  // ---- Environment -------------------------------------------------------
  setBackground(color: number | string): void;
  setShadowsEnabled(enabled: boolean): void;

  // ---- Editor helpers ----------------------------------------------------
  setGridVisible(visible: boolean): void;
  setAxesVisible(visible: boolean): void;
  /** Add or update a bounding-box highlight around an entity mesh. */
  setEntityHighlight(entityRef: string, visible: boolean, color?: number): void;

  /**
   * Create or update a named batch of debug line segments.
   * `vertices` is xyz triplets (2 per segment); `colors` is rgba per vertex.
   */
  setDebugLines(id: string, vertices: Float32Array, colors: Float32Array): void;
  removeDebugLines(id: string): void;

  // ---- Screen-space projection -------------------------------------------
  /** Project a 3D world position to canvas pixel coordinates. Returns undefined if no active camera. */
  worldToScreen(worldPos: IVec3): { x: number; y: number } | undefined;

  // ---- Picking -------------------------------------------------------------
  /**
   * Raycast into the scene through the given canvas pixel coordinates.
   * Returns the entityRefs of hit meshes, nearest first.
   */
  pickEntities(screenX: number, screenY: number): string[];

  /**
   * Intersect a ray through the given canvas pixel coordinates with the
   * horizontal plane `y = planeY`. Returns the world-space hit point, or
   * undefined if the ray is parallel to / points away from the plane.
   */
  screenToGroundPoint(screenX: number, screenY: number, planeY?: number): IVec3 | undefined;

  dispose(): void;
}
