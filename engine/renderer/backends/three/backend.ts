/**
 * Three.js renderer backend.
 *
 * The ONLY file in the engine that imports Three.js directly.
 * All game/entity code talks exclusively to IRendererBackend.
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
// Texture cache — shared across all backend instances
// ---------------------------------------------------------------------------
const textureCache = new Map<string, THREE.Texture>();

function loadTexture(url: string): THREE.Texture {
  const cached = textureCache.get(url);
  if (cached) return cached;
  const tex = new THREE.TextureLoader().load(url, t => {
    t.needsUpdate = true;
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(url, tex);
  return tex;
}

// ---------------------------------------------------------------------------
// Geometry builder
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
        desc.radiusTop, desc.radiusBottom, desc.height, desc.segments ?? 32,
      );
    case "cone":
      return new THREE.ConeGeometry(desc.radius, desc.height, desc.segments ?? 32);
    case "plane":
      return new THREE.PlaneGeometry(desc.width, desc.height);
    case "polygon": {
      // Regular polygon using CircleGeometry (a circle with N sides ≈ polygon)
      return new THREE.CircleGeometry(
        Math.max(desc.width, desc.height) / 2,
        Math.max(3, desc.sides),
        0,
        Math.PI * 2,
      );
    }
    case "gltf":
      return new THREE.BoxGeometry(1, 1, 1); // placeholder until GLTF loads
    default: {
      const _e: never = desc;
      return new THREE.BoxGeometry(1, 1, 1);
    }
  }
}

// ---------------------------------------------------------------------------
// Material builder
// ---------------------------------------------------------------------------
function parseSide(side?: "front" | "double" | "back"): THREE.Side {
  if (side === "double") return THREE.DoubleSide;
  if (side === "back") return THREE.BackSide;
  return THREE.FrontSide;
}

function buildMaterial(desc: MaterialDesc): THREE.Material {
  const side = parseSide(desc.side);

  if (desc.type === "unlit") {
    const mat = new THREE.MeshBasicMaterial({
      color: desc.color ?? 0xffffff,
      wireframe: desc.wireframe ?? false,
      transparent: desc.transparent ?? (desc.opacity !== undefined && desc.opacity < 1) ?? false,
      opacity: desc.opacity ?? 1,
      side,
      alphaTest: desc.alphaTest ?? 0,
    });
    if (desc.texture) {
      const tex = loadTexture(desc.texture);
      if (desc.uvRepeat) {
        tex.repeat.set(desc.uvRepeat.x, desc.uvRepeat.y);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
      }
      if (desc.uvOffset) {
        tex.offset.set(desc.uvOffset.x, desc.uvOffset.y);
      }
      mat.map = tex;
    }
    return mat;
  }

  // Default: standard (PBR)
  const mat = new THREE.MeshStandardMaterial({
    color: desc.color ?? 0xffffff,
    roughness: desc.roughness ?? 0.7,
    metalness: desc.metalness ?? 0,
    wireframe: desc.wireframe ?? false,
    transparent: desc.transparent ?? (desc.opacity !== undefined && desc.opacity < 1) ?? false,
    opacity: desc.opacity ?? 1,
    emissive: new THREE.Color(desc.emissive ?? 0x000000),
    emissiveIntensity: desc.emissiveIntensity ?? 1,
    side,
    alphaTest: desc.alphaTest ?? 0,
  });
  if (desc.texture) {
    const tex = loadTexture(desc.texture);
    if (desc.uvRepeat) {
      tex.repeat.set(desc.uvRepeat.x, desc.uvRepeat.y);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
    }
    if (desc.uvOffset) {
      tex.offset.set(desc.uvOffset.x, desc.uvOffset.y);
    }
    mat.map = tex;
  }
  return mat;
}

// ---------------------------------------------------------------------------
// Apply partial MaterialDesc to an existing material (in-place update)
// ---------------------------------------------------------------------------
function applyMaterialUpdate(mat: THREE.Material, desc: Partial<MaterialDesc>): void {
  const basic = mat as THREE.MeshBasicMaterial;
  const standard = mat as THREE.MeshStandardMaterial;

  if (desc.color !== undefined) {
    basic.color?.set(desc.color as (string | number));
  }
  if (desc.opacity !== undefined) {
    mat.opacity = desc.opacity;
  }
  if (desc.transparent !== undefined) {
    mat.transparent = desc.transparent;
  } else if (desc.opacity !== undefined) {
    mat.transparent = desc.opacity < 1;
  }
  if (desc.wireframe !== undefined) {
    (mat as THREE.MeshBasicMaterial).wireframe = desc.wireframe;
  }
  if (desc.alphaTest !== undefined) {
    mat.alphaTest = desc.alphaTest;
  }
  if (desc.side !== undefined) {
    mat.side = parseSide(desc.side);
  }
  if (desc.roughness !== undefined && standard.roughness !== undefined) {
    standard.roughness = desc.roughness;
  }
  if (desc.metalness !== undefined && standard.metalness !== undefined) {
    standard.metalness = desc.metalness;
  }

  // Texture change
  if (desc.texture !== undefined) {
    const newMap = desc.texture ? loadTexture(desc.texture) : null;
    if (basic.map !== newMap) {
      basic.map = newMap;
      mat.needsUpdate = true;
    }
  }

  // UV updates apply to the current texture
  const map = basic.map;
  if (map) {
    let uvDirty = false;
    if (desc.uvRepeat !== undefined) {
      map.repeat.set(desc.uvRepeat.x, desc.uvRepeat.y);
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.RepeatWrapping;
      uvDirty = true;
    }
    if (desc.uvOffset !== undefined) {
      map.offset.set(desc.uvOffset.x, desc.uvOffset.y);
      uvDirty = true;
    }
    if (uvDirty) map.needsUpdate = true;
  }

  mat.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// Backend
// ---------------------------------------------------------------------------
export class ThreeRendererBackend implements IRendererBackend {
  readonly canvas: HTMLCanvasElement;
  #renderer: THREE.WebGLRenderer;
  #scene: THREE.Scene;
  #gridHelper: THREE.GridHelper;
  #axesHelper: THREE.AxesHelper;
  #handleCounter = 1;

  #meshes = new Map<MeshHandle, THREE.Mesh>();
  #lights = new Map<LightHandle, THREE.Light>();
  #cameras = new Map<CameraHandle, THREE.PerspectiveCamera>();
  #activeCameraHandle: CameraHandle | undefined;
  #boxHelpers = new Map<string, THREE.BoxHelper>();

  constructor(container: HTMLDivElement) {
    this.#renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.#renderer.setPixelRatio(globalThis.devicePixelRatio ?? 1);
    this.#renderer.setSize(container.clientWidth || 800, container.clientHeight || 600);
    this.#renderer.shadowMap.enabled = true;
    this.#renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.#renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.canvas = this.#renderer.domElement;
    this.canvas.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;";
    container.style.position = "relative";
    container.appendChild(this.canvas);

    this.#scene = new THREE.Scene();
    this.#scene.background = new THREE.Color(0x1a1a2e);

    this.#gridHelper = new THREE.GridHelper(20, 20, 0x444455, 0x333344);
    this.#scene.add(this.#gridHelper);

    this.#axesHelper = new THREE.AxesHelper(5);
    this.#scene.add(this.#axesHelper);
  }

  // ---- Frame ---------------------------------------------------------------

  render(): void {
    const cam = this.#activeCameraHandle !== undefined
      ? this.#cameras.get(this.#activeCameraHandle)
      : undefined;
    if (!cam) return;

    // Update box helpers
    for (const helper of this.#boxHelpers.values()) {
      helper.update();
    }

    this.#renderer.render(this.#scene, cam);
  }

  resize(width: number, height: number): void {
    this.#renderer.setSize(width, height);
    for (const cam of this.#cameras.values()) {
      cam.aspect = width / height;
      cam.updateProjectionMatrix();
    }
  }

  setPixelRatio(ratio: number): void {
    this.#renderer.setPixelRatio(ratio);
  }

  // ---- Meshes --------------------------------------------------------------

  createMesh(entityRef: string, geometry: GeometryDesc, material: MaterialDesc): MeshHandle {
    const geo = buildGeometry(geometry);
    const mat = buildMaterial(material);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = material.castShadow ?? true;
    mesh.receiveShadow = material.receiveShadow ?? true;
    mesh.userData["entityRef"] = entityRef;
    this.#scene.add(mesh);
    const handle = this.#handleCounter++ as unknown as MeshHandle;
    this.#meshes.set(handle, mesh);
    return handle;
  }

  destroyMesh(handle: MeshHandle): void {
    const mesh = this.#meshes.get(handle);
    if (!mesh) return;
    mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) {
      for (const m of mesh.material) m.dispose();
    } else {
      (mesh.material as THREE.Material).dispose();
    }
    this.#scene.remove(mesh);
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
    const newGeo = buildGeometry(geometry);
    mesh.geometry.dispose();
    mesh.geometry = newGeo;
  }

  updateMeshMaterial(handle: MeshHandle, desc: Partial<MaterialDesc>): void {
    const mesh = this.#meshes.get(handle);
    if (!mesh) return;
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material as THREE.Material;
    applyMaterialUpdate(mat, desc);

    if (desc.castShadow !== undefined) mesh.castShadow = desc.castShadow;
    if (desc.receiveShadow !== undefined) mesh.receiveShadow = desc.receiveShadow;
  }

  // ---- Lights --------------------------------------------------------------

  createLight(_entityRef: string, desc: LightDesc): LightHandle {
    const light = this.#buildLight(desc);
    this.#scene.add(light);
    const handle = this.#handleCounter++ as unknown as LightHandle;
    this.#lights.set(handle, light);
    return handle;
  }

  #buildLight(desc: LightDesc): THREE.Light {
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
        return new THREE.PointLight(desc.color, desc.intensity, desc.distance ?? 0, desc.decay ?? 2);
      case "spot": {
        const l = new THREE.SpotLight(
          desc.color, desc.intensity, desc.distance ?? 0,
          desc.angle, desc.penumbra ?? 0, desc.decay ?? 2,
        );
        return l;
      }
      default: {
        const _e: never = desc;
        return new THREE.AmbientLight(0xffffff, 1);
      }
    }
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
  }

  setLightVisible(handle: LightHandle, visible: boolean): void {
    const light = this.#lights.get(handle);
    if (light) light.visible = visible;
  }

  updateLight(handle: LightHandle, desc: Partial<LightDesc>): void {
    const light = this.#lights.get(handle);
    if (!light) return;
    if (desc.intensity !== undefined) light.intensity = desc.intensity;
    if ("color" in desc && desc.color !== undefined) light.color.setHex(desc.color as number);
    if (light instanceof THREE.PointLight) {
      if ("distance" in desc && desc.distance !== undefined) light.distance = desc.distance;
      if ("decay" in desc && desc.decay !== undefined) light.decay = desc.decay;
    }
    if (light instanceof THREE.SpotLight) {
      if ("angle" in desc && desc.angle !== undefined) light.angle = desc.angle;
      if ("penumbra" in desc && desc.penumbra !== undefined) light.penumbra = desc.penumbra;
    }
  }

  // ---- Cameras -------------------------------------------------------------

  createCamera(_entityRef: string, desc: CameraDesc): CameraHandle {
    const w = this.canvas.clientWidth || this.canvas.width || 1;
    const h = this.canvas.clientHeight || this.canvas.height || 1;
    const cam = new THREE.PerspectiveCamera(
      desc.fov ?? 75, w / h, desc.near ?? 0.1, desc.far ?? 1000,
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

  // ---- Environment ---------------------------------------------------------

  setBackground(color: number | string): void {
    (this.#scene.background as THREE.Color).set(color as number);
  }

  setShadowsEnabled(enabled: boolean): void {
    this.#renderer.shadowMap.enabled = enabled;
    this.#renderer.shadowMap.needsUpdate = true;
  }

  // ---- Editor helpers ------------------------------------------------------

  setGridVisible(visible: boolean): void {
    this.#gridHelper.visible = visible;
  }

  setAxesVisible(visible: boolean): void {
    this.#axesHelper.visible = visible;
  }

  setEntityHighlight(entityRef: string, visible: boolean, color = 0x22a2ff): void {
    if (!visible) {
      const helper = this.#boxHelpers.get(entityRef);
      if (helper) {
        this.#scene.remove(helper);
        this.#boxHelpers.delete(entityRef);
      }
      return;
    }

    // Find the mesh for this entity
    let targetMesh: THREE.Object3D | undefined;
    for (const [, mesh] of this.#meshes) {
      if (mesh.userData["entityRef"] === entityRef) {
        targetMesh = mesh;
        break;
      }
    }
    if (!targetMesh) return;

    const existing = this.#boxHelpers.get(entityRef);
    if (existing) {
      (existing as unknown as { object: THREE.Object3D }).object = targetMesh;
      existing.setFromObject(targetMesh);
      (existing.material as THREE.LineBasicMaterial).color.setHex(color);
      return;
    }

    const helper = new THREE.BoxHelper(targetMesh, color);
    this.#scene.add(helper);
    this.#boxHelpers.set(entityRef, helper);
  }

  // ---- Picking ---------------------------------------------------------------

  #raycaster = new THREE.Raycaster();

  #screenToNDC(screenX: number, screenY: number): THREE.Vector2 {
    const w = this.canvas.clientWidth || this.canvas.width;
    const h = this.canvas.clientHeight || this.canvas.height;
    return new THREE.Vector2((screenX / w) * 2 - 1, -(screenY / h) * 2 + 1);
  }

  pickEntities(screenX: number, screenY: number): string[] {
    const cam = this.#activeCameraHandle !== undefined
      ? this.#cameras.get(this.#activeCameraHandle)
      : undefined;
    if (!cam) return [];

    cam.updateMatrixWorld();
    this.#raycaster.setFromCamera(this.#screenToNDC(screenX, screenY), cam);
    const hits = this.#raycaster.intersectObjects([...this.#meshes.values()], false);

    const refs: string[] = [];
    for (const hit of hits) {
      const ref = hit.object.userData["entityRef"];
      if (typeof ref === "string" && !refs.includes(ref)) refs.push(ref);
    }
    return refs;
  }

  screenToGroundPoint(screenX: number, screenY: number, planeY = 0): IVec3 | undefined {
    const cam = this.#activeCameraHandle !== undefined
      ? this.#cameras.get(this.#activeCameraHandle)
      : undefined;
    if (!cam) return undefined;

    cam.updateMatrixWorld();
    this.#raycaster.setFromCamera(this.#screenToNDC(screenX, screenY), cam);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
    const hit = new THREE.Vector3();
    if (this.#raycaster.ray.intersectPlane(plane, hit) === null) return undefined;
    return { x: hit.x, y: hit.y, z: hit.z };
  }

  // ---- Screen-space projection ---------------------------------------------

  worldToScreen(worldPos: IVec3): { x: number; y: number } | undefined {
    const cam = this.#activeCameraHandle !== undefined
      ? this.#cameras.get(this.#activeCameraHandle)
      : undefined;
    if (!cam) return undefined;

    const vec = new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z);
    vec.project(cam);

    const w = this.canvas.clientWidth || this.canvas.width;
    const h = this.canvas.clientHeight || this.canvas.height;

    return {
      x: (vec.x + 1) / 2 * w,
      y: (-vec.y + 1) / 2 * h,
    };
  }

  // ---- Lifecycle -----------------------------------------------------------

  dispose(): void {
    for (const mesh of this.#meshes.values()) {
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        for (const m of mesh.material) m.dispose();
      } else {
        (mesh.material as THREE.Material).dispose();
      }
    }
    for (const helper of this.#boxHelpers.values()) {
      this.#scene.remove(helper);
    }
    this.#renderer.dispose();
  }
}
