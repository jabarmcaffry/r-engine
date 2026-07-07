import type { IVec3 } from "../math/vec3.ts";
import type { IQuat } from "../math/quat.ts";

// ---------------------------------------------------------------------------
// Opaque handle types — game code never touches Three.js / WebGPU objects.
// Swapping the renderer backend never breaks entity types or behaviors.
// ---------------------------------------------------------------------------
export type MeshHandle = number & { readonly _brand: "MeshHandle" };
export type LightHandle = number & { readonly _brand: "LightHandle" };
export type CameraHandle = number & { readonly _brand: "CameraHandle" };

// ---------------------------------------------------------------------------
// Descriptor types (pure data, no backend coupling)
// ---------------------------------------------------------------------------
export type GeometryDesc =
  | { type: "box"; width: number; height: number; depth: number }
  | { type: "sphere"; radius: number; segments?: number }
  | { type: "capsule"; radius: number; height: number; segments?: number }
  | { type: "cylinder"; radiusTop: number; radiusBottom: number; height: number; segments?: number }
  | { type: "cone"; radius: number; height: number; segments?: number }
  | { type: "plane"; width: number; height: number }
  | { type: "gltf"; url: string };

export interface MaterialDesc {
  type?: "standard" | "unlit";
  color?: number;         // 0xRRGGBB hex
  texture?: string;       // URL or res:// URI
  roughness?: number;
  metalness?: number;
  emissive?: number;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  wireframe?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
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
// Entity types (Mesh, Camera, PointLight…) import ONLY this interface.
// ---------------------------------------------------------------------------
export interface IRendererBackend {
  readonly canvas: HTMLCanvasElement;

  // ---- Frame -------------------------------------------------------------
  /** Render a frame using the currently active camera. */
  render(): void;
  resize(width: number, height: number): void;
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
  setBackground(color: number): void;
  setShadowsEnabled(enabled: boolean): void;

  // ---- Editor helpers (no-ops in production) ----------------------------
  setGridVisible(visible: boolean): void;
  setAxesVisible(visible: boolean): void;

  dispose(): void;
}
