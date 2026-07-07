/**
 * Three.js renderer backend.
 *
 * This is the ONLY file in the engine that imports Three.js directly.
 * All game code (entities, behaviors) talks exclusively to IRendererBackend.
 * Swapping to Babylon.js, WebGPU, or a custom renderer means replacing this file only.
 */

import * as THREE from "@rebur/vendor/three.ts";
import type {
  IRendererBackend,
  MeshHandle,
  LightHandle,
  CameraHandle,
  GeometryDesc,
  MaterialDesc,
  LightDesc,
  CameraDesc,
} from "../../api.ts";
import type { IVec3 } from "../../../math/vec3.ts";
import type { IQuat } from "../../../math/quat.ts";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildGeometry(desc: GeometryDesc): THREE.BufferGeometry {
  switch (desc.type) {
    case "box":
      return new THREE.BoxGeometry(desc.width, desc.height, desc.depth);
    case "sphere":
      return new THREE.SphereGeometry(desc.radius, desc.segments ?? 32, (desc.segments ?? 32) / 2);
    case "capsule":
      return new THREE.CapsuleGeometry(desc.radius, desc.height, 4, desc.segments ?? 16);
    case "cylinder":
      return new THREE.CylinderGeometry(
        desc.radiusTop,
        desc.radiusBottom,
        desc.height,
        desc.segments ?? 32,
      );
    case "cone":
      return new THREE.ConeGeometry(desc.radius, desc.height, desc.segments ?? 32);
    case "plane":
      return new THREE.PlaneGeometry(desc.width, desc.height);
    case "gltf":
      // Placeholder until the async GLTF loader resolves (loaded separately in the entity type)
      return new THREE.BoxGeometry(1, 1, 1);
    default: {
      const _e: never = desc;
      return new THREE.BoxGeometry(1, 1, 1);
    }
  }
}

function buildMaterial(desc: MaterialDesc): THREE.Material {
  if (desc.type === "unlit") {
    const mat = new THREE.MeshBasicMaterial({
      color: desc.color ?? 0xffffff,
      wireframe: desc.wireframe ?? false,
      transparent: desc.transparent ?? false,
      opacity: desc.opacity ?? 1,
    });
    if (desc.texture) mat.map = new THREE.TextureLoader().load(desc.texture);
    return mat;
  }

  // Default: standard (PBR)
  const mat = new THREE.MeshStandardMaterial({
    color: desc.color ?? 0xffffff,
    roughness: desc.roughness ?? 0.7,
    metalness: desc.metalness ?? 0,
    wireframe: desc.wireframe ?? false,
    transparent: desc.transparent ?? false,
    opacity: desc.opacity ?? 1,
    emissive: new THREE.Color(desc.emissive ?? 0x000000),
    emissiveIntensity: desc.emissiveIntensity ?? 1,
  });
  if (desc.texture) mat.map = new THREE.TextureLoader().load(desc.texture);
  return mat;
}

function buildLight(desc: LightDesc): THREE.Light {
  switch (desc.type) {
    case "ambient":
      return new THREE.AmbientLight(desc.color, desc.intensity);
    case "hemisphere":
      return new THREE.HemisphereLight(desc.skyColor, desc.groundColor, desc.intensity);
    case "directional": {
      const l = new THREE.DirectionalLight(desc.color, desc.intensity);
      if (desc.castShadow) {
        l.castShadow = true;
        l.shadow.mapSize.set(2048, 2048);
        l.shadow.camera.near = 0.1;
        l.shadow.camera.far = 500;
        l.shadow.camera.left = -50;
        l.shadow.camera.right = 50;
        l.shadow.camera.top = 50;
        l.shadow.camera.bottom = -50;
      }
      return l;
    }
    case "point":
      return new THREE.PointLight(
        desc.color,
        desc.intensity,
        desc.distance ?? 0,
        desc.decay ?? 2,
      );
    case "spot": {
      const l = new THREE.SpotLight(
        desc.color,
        desc.intensity,
        desc.distance ?? 0,
        desc.angle,
        desc.penumbra ?? 0,
        desc.decay ?? 2,
      );
      return l;
    }
    default: {
      const _e: never = desc;
      return new THREE.AmbientLight(0xffffff, 0.5);
    }
  }
}

// ---------------------------------------------------------------------------
// Three.js backend implementation
// ---------------------------------------------------------------------------

export class ThreeRendererBackend implements IRendererBackend {
  readonly canvas: HTMLCanvasElement;

  readonly #renderer: THREE.WebGLRenderer;
  readonly #scene: THREE.Scene;

  #handleCounter = 1;
  readonly #meshes = new Map<MeshHandle, THREE.Mesh>();
  readonly #lights = new Map<LightHandle, THREE.Light>();
  readonly #cameras = new Map<CameraHandle, THREE.PerspectiveCamera>();
  #activeCameraHandle: CameraHandle | undefined;

  readonly #gridHelper: THREE.GridHelper;
  readonly #axesHelper: THREE.AxesHelper;

  constructor(container: HTMLDivElement) {
    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText = "width:100%;height:100%;display:block;";
    container.appendChild(this.canvas);

    this.#renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
    });
    this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.#renderer.shadowMap.enabled = true;
    this.#renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.#renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.#scene = new THREE.Scene();
    this.#scene.background = new THREE.Color(0x1a1a2e);

    this.#gridHelper = new THREE.GridHelper(200, 200, 0x444444, 0x333333);
    this.#gridHelper.visible = false;
    this.#scene.add(this.#gridHelper);

    this.#axesHelper = new THREE.AxesHelper(5);
    this.#axesHelper.visible = false;
    this.#scene.add(this.#axesHelper);

    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;
    this.#renderer.setSize(w, h, false);
  }

  // ---- Frame -------------------------------------------------------------

  render(): void {
    if (this.#activeCameraHandle === undefined) return;
    const cam = this.#cameras.get(this.#activeCameraHandle);
    if (!cam) return;
    this.#renderer.render(this.#scene, cam);
  }

  resize(width: number, height: number): void {
    this.#renderer.setSize(width, height, false);
    for (const cam of this.#cameras.values()) {
      cam.aspect = width / height;
      cam.updateProjectionMatrix();
    }
  }

  setPixelRatio(ratio: number): void {
    this.#renderer.setPixelRatio(ratio);
  }

  // ---- Meshes ------------------------------------------------------------

  createMesh(_entityRef: string, geometry: GeometryDesc, material: MaterialDesc): MeshHandle {
    const geo = buildGeometry(geometry);
    const mat = buildMaterial(material);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = material.castShadow ?? true;
    mesh.receiveShadow = material.receiveShadow ?? true;
    this.#scene.add(mesh);
    const handle = this.#handleCounter++ as unknown as MeshHandle;
    this.#meshes.set(handle, mesh);
    return handle;
  }

  destroyMesh(handle: MeshHandle): void {
    const mesh = this.#meshes.get(handle);
    if (!mesh) return;
    this.#scene.remove(mesh);
    mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) {
      for (const m of mesh.material) m.dispose();
    } else {
      (mesh.material as THREE.Material).dispose();
    }
    this.#meshes.delete(handle);
  }

  setMeshTransform(handle: MeshHandle, pos: IVec3, rot: IQuat, scale: IVec3): void {
    const mesh = this.#meshes.get(handle);
    if (!mesh) return;
    mesh.position.set(pos.x, pos.y, pos.z);
    mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
    mesh.scale.set(scale.x, scale.y, scale.z);
  }

  setMeshVisible(handle: MeshHandle, visible: boolean): void {
    const mesh = this.#meshes.get(handle);
    if (mesh) mesh.visible = visible;
  }

  updateMeshGeometry(handle: MeshHandle, geometry: GeometryDesc): void {
    const mesh = this.#meshes.get(handle);
    if (!mesh) return;
    mesh.geometry.dispose();
    mesh.geometry = buildGeometry(geometry);
  }

  updateMeshMaterial(handle: MeshHandle, desc: Partial<MaterialDesc>): void {
    const mesh = this.#meshes.get(handle);
    if (!mesh) return;
    const mat = mesh.material as THREE.MeshStandardMaterial & THREE.MeshBasicMaterial;
    if (desc.color !== undefined) mat.color.setHex(desc.color);
    if (desc.opacity !== undefined) mat.opacity = desc.opacity;
    if (desc.wireframe !== undefined) mat.wireframe = desc.wireframe;
    if (desc.transparent !== undefined) mat.transparent = desc.transparent;
    if (desc.castShadow !== undefined) mesh.castShadow = desc.castShadow;
    if (desc.receiveShadow !== undefined) mesh.receiveShadow = desc.receiveShadow;
    if ("roughness" in mat && desc.roughness !== undefined) mat.roughness = desc.roughness;
    if ("metalness" in mat && desc.metalness !== undefined) mat.metalness = desc.metalness;
    mat.needsUpdate = true;
  }

  // ---- Lights ------------------------------------------------------------

  createLight(_entityRef: string, desc: LightDesc): LightHandle {
    const light = buildLight(desc);
    this.#scene.add(light);
    const handle = this.#handleCounter++ as unknown as LightHandle;
    this.#lights.set(handle, light);
    return handle;
  }

  destroyLight(handle: LightHandle): void {
    const light = this.#lights.get(handle);
    if (!light) return;
    this.#scene.remove(light);
    this.#lights.delete(handle);
  }

  setLightTransform(handle: LightHandle, pos: IVec3, rot: IQuat): void {
    const light = this.#lights.get(handle);
    if (!light) return;
    light.position.set(pos.x, pos.y, pos.z);
    light.quaternion.set(rot.x, rot.y, rot.z, rot.w);
    if (light instanceof THREE.DirectionalLight) {
      light.target.position.set(
        pos.x - Math.sin(rot.y) * 10,
        pos.y - Math.cos(rot.x) * 10,
        pos.z - Math.cos(rot.y) * 10,
      );
    }
  }

  setLightVisible(handle: LightHandle, visible: boolean): void {
    const light = this.#lights.get(handle);
    if (light) light.visible = visible;
  }

  updateLight(handle: LightHandle, desc: Partial<LightDesc>): void {
    const light = this.#lights.get(handle);
    if (!light) return;
    if ("intensity" in desc && desc.intensity !== undefined) light.intensity = desc.intensity;
    if ("color" in desc && desc.color !== undefined) light.color.setHex(desc.color as number);
    if (light instanceof THREE.PointLight && "distance" in desc && desc.distance !== undefined)
      light.distance = desc.distance;
    if (light instanceof THREE.SpotLight && "angle" in desc && desc.angle !== undefined)
      light.angle = desc.angle;
  }

  // ---- Cameras -----------------------------------------------------------

  createCamera(_entityRef: string, desc: CameraDesc): CameraHandle {
    const w = this.canvas.clientWidth || this.canvas.width || 1;
    const h = this.canvas.clientHeight || this.canvas.height || 1;
    const cam = new THREE.PerspectiveCamera(
      desc.fov ?? 75,
      w / h,
      desc.near ?? 0.1,
      desc.far ?? 1000,
    );
    this.#scene.add(cam);
    const handle = this.#handleCounter++ as unknown as CameraHandle;
    this.#cameras.set(handle, cam);
    return handle;
  }

  destroyCamera(handle: CameraHandle): void {
    const cam = this.#cameras.get(handle);
    if (!cam) return;
    this.#scene.remove(cam);
    this.#cameras.delete(handle);
    if (this.#activeCameraHandle === handle) this.#activeCameraHandle = undefined;
  }

  setCameraTransform(handle: CameraHandle, pos: IVec3, rot: IQuat): void {
    const cam = this.#cameras.get(handle);
    if (!cam) return;
    cam.position.set(pos.x, pos.y, pos.z);
    cam.quaternion.set(rot.x, rot.y, rot.z, rot.w);
  }

  setActiveCamera(handle: CameraHandle): void {
    this.#activeCameraHandle = handle;
  }

  getActiveCameraHandle(): CameraHandle | undefined {
    return this.#activeCameraHandle;
  }

  updateCamera(handle: CameraHandle, desc: Partial<CameraDesc>): void {
    const cam = this.#cameras.get(handle);
    if (!cam) return;
    if (desc.fov !== undefined) cam.fov = desc.fov;
    if (desc.near !== undefined) cam.near = desc.near;
    if (desc.far !== undefined) cam.far = desc.far;
    cam.updateProjectionMatrix();
  }

  // ---- Environment -------------------------------------------------------

  setBackground(color: number): void {
    (this.#scene.background as THREE.Color).setHex(color);
  }

  setShadowsEnabled(enabled: boolean): void {
    this.#renderer.shadowMap.enabled = enabled;
    this.#renderer.shadowMap.needsUpdate = true;
  }

  // ---- Editor helpers ----------------------------------------------------

  setGridVisible(visible: boolean): void {
    this.#gridHelper.visible = visible;
  }

  setAxesVisible(visible: boolean): void {
    this.#axesHelper.visible = visible;
  }

  // ---- Lifecycle ---------------------------------------------------------

  dispose(): void {
    for (const mesh of this.#meshes.values()) {
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        for (const m of mesh.material) m.dispose();
      } else {
        (mesh.material as THREE.Material).dispose();
      }
    }
    for (const _l of this.#lights.values()) {/* lights need no dispose */}
    this.#renderer.dispose();
  }
}
