import {
  Entity,
  EntitySpawned,
  EntityDestroyed,
  EntityEnableChanged,
  type EntityContext,
  type Game,
  Vector2,
  Vec3,
} from "@rebur/engine";
import type { CameraHandle } from "../../renderer/api.ts";

export class Camera extends Entity {
  static {
    Entity.registerType(this, "@core");
  }

  static readonly icon = "📷";

  active: boolean = true;
  fov: number = 75;
  near: number = 0.1;
  far: number = 1000;

  /**
   * Editor-facing zoom level. A zoom of 1 = camera at its default distance.
   * Higher zoom = camera moves closer. Controlled by CameraPanBehavior.
   * Stored on the Camera so editor behaviors can read/write it.
   */
  zoom: number = 1;

  /**
   * Editor-facing focus/pan position (world XZ plane).
   * Camera orbits around this point. Controlled by CameraPanBehavior.
   * Mutated in-place by the editor (uses .assign()).
   */
  pos: Vec3 = new Vec3(0, 0, 0);

  /** Base distance from focus point when zoom == 1. */
  static readonly BASE_DISTANCE = 20;

  /** Viewport size constant used by editor facades for coordinate math. */
  static readonly TARGET_VIEWPORT_SIZE = 1024;

  #cameraHandle: CameraHandle | undefined;

  get bounds() { return undefined; }

  constructor(ctx: EntityContext) {
    super(ctx);

    this.defineValue(Camera, "active", { description: "Whether this camera renders the scene." });
    this.defineValue(Camera, "fov", { description: "Vertical field of view in degrees." });
    this.defineValue(Camera, "near", { description: "Near clipping plane." });
    this.defineValue(Camera, "far", { description: "Far clipping plane." });
    this.defineValue(Camera, "zoom", { description: "Editor zoom level (1 = default distance)." });

    this.on(EntitySpawned, () => {
      const game = this.game;
      if (!game.isClient()) return;
      this.#cameraHandle = game.renderer.createCamera(this.ref, {
        fov: this.fov,
        near: this.near,
        far: this.far,
      });
      if (this.active) game.renderer.setActiveCamera(this.#cameraHandle);
    });

    this.on(EntityDestroyed, () => {
      const game = this.game;
      if (!game.isClient() || this.#cameraHandle === undefined) return;
      game.renderer.destroyCamera(this.#cameraHandle);
    });

    this.on(EntityEnableChanged, ({ enabled }) => {
      const game = this.game;
      if (!game.isClient() || this.#cameraHandle === undefined) return;
      if (enabled && this.active) game.renderer.setActiveCamera(this.#cameraHandle);
    });
  }

  /**
   * Returns the first Camera entity that has `active === true`.
   * Used by inputs, behaviors, and editor code.
   */
  static getActive(game: Game): Camera | undefined {
    return game.entities.lookupByType(Camera).find(c => c.active);
  }

  /**
   * Convert a screen-space delta (pixels) to a world-space delta.
   * In the 3D editor this scales pixel offsets by the camera distance (zoom-dependent).
   */
  screenToWorld(screen: { x: number; y: number }): Vector2 {
    // Canvas size
    const canvas = this.game.isClient() ? this.game.renderer.canvas : undefined;
    const canvasH = canvas?.clientHeight || 600;
    const distance = Camera.BASE_DISTANCE / Math.max(0.001, this.zoom);

    // How many world units per pixel at this distance and FOV
    const fovRad = this.fov * (Math.PI / 180);
    const worldUnitsPerPixelY = (2 * Math.tan(fovRad / 2) * distance) / canvasH;
    const worldUnitsPerPixelX = worldUnitsPerPixelY;

    return new Vector2(
      screen.x * worldUnitsPerPixelX,
      screen.y * worldUnitsPerPixelY,
    );
  }

  activate(): void {
    this.active = true;
    const game = this.game;
    if (game.isClient() && this.#cameraHandle !== undefined) {
      game.renderer.setActiveCamera(this.#cameraHandle);
    }
  }

  onFrame(): void {
    const game = this.game;
    if (!game.isClient() || this.#cameraHandle === undefined) return;

    // Position camera above the focus point (pos), looking down at it
    const distance = Camera.BASE_DISTANCE / Math.max(0.001, this.zoom);
    const camPos = new Vec3(this.pos.x, this.pos.y + distance, this.pos.z + distance * 0.5);

    // Look toward the focus point from above/front
    // Pitch: -45° looking down-forward
    const { Quat } = (this as unknown as { game: { math?: Record<string, unknown> } });
    const pitchAngle = -Math.atan2(1, 1); // 45° downward
    const pitchQuat = { x: Math.sin(pitchAngle / 2), y: 0, z: 0, w: Math.cos(pitchAngle / 2) };

    game.renderer.setCameraTransform(this.#cameraHandle, camPos, pitchQuat);
    if (this.active) game.renderer.setActiveCamera(this.#cameraHandle);
    game.renderer.updateCamera(this.#cameraHandle, { fov: this.fov, near: this.near, far: this.far });
  }
}
