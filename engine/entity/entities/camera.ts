import {
  Entity,
  EntitySpawned,
  EntityDestroyed,
  EntityEnableChanged,
  GameRender,
  type EntityContext,
  type Game,
  Vector2,
  Vec3,
  Quat,
} from "@rebur/engine";
import type { CameraHandle } from "../../renderer/api.ts";

/**
 * Perspective camera.
 *
 * Two positioning modes:
 * - **Transform mode** (default, used in games): the camera renders from the
 *   entity's own world transform. Move/rotate the entity (or parent it to a
 *   character rig) to control the view.
 * - **Orbit mode** (used by the editor viewport): the camera orbits a `focus`
 *   point at a distance controlled by `zoom`, pitched down 45°. The editor's
 *   pan/zoom controls drive `focus` and `zoom` directly.
 */
export class Camera extends Entity {
  static {
    Entity.registerType(this, "@core");
  }

  static readonly icon: string = "📷";

  active: boolean = true;
  fov: number = 75;
  near: number = 0.1;
  far: number = 1000;

  /**
   * When true, the camera positions itself by orbiting `focus` (editor
   * viewport behaviour). When false, the camera uses the entity transform.
   */
  orbit: boolean = false;

  /**
   * Orbit-mode zoom level. 1 = camera at BASE_DISTANCE from focus.
   * Higher zoom = closer. Ignored in transform mode.
   */
  zoom: number = 1;

  /**
   * Orbit-mode focus point (world space). The editor pans by mutating this
   * in place (uses `.assign()`). Ignored in transform mode.
   */
  focus: Vec3 = new Vec3(0, 0, 0);

  /** Base distance from focus point when zoom == 1. */
  static readonly BASE_DISTANCE = 20;

  /** Viewport size constant used by editor facades for coordinate math. */
  static readonly TARGET_VIEWPORT_SIZE = 1024;

  #cameraHandle: CameraHandle | undefined;

  get bounds() {
    return undefined;
  }

  constructor(ctx: EntityContext) {
    super(ctx);

    this.listen(this.game, GameRender, () => this.#onFrame());

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

  /** Current camera distance from the focus point (orbit mode). */
  get orbitDistance(): number {
    return Camera.BASE_DISTANCE / Math.max(0.001, this.zoom);
  }

  /**
   * Convert a screen-space delta (pixels) to a world-space delta at the focus
   * distance. Used by the editor for drag-to-pan. Returns a 2D delta: x maps
   * to world X, y maps to the view's vertical axis.
   */
  screenToWorld(screen: { x: number; y: number }): Vector2 {
    const canvas = this.game.isClient() ? this.game.renderer.canvas : undefined;
    const canvasH = canvas?.clientHeight || 600;
    const distance = this.orbit ? this.orbitDistance : Camera.BASE_DISTANCE;

    // world units per pixel at this distance and FOV
    const fovRad = this.fov * (Math.PI / 180);
    const worldUnitsPerPixel = (2 * Math.tan(fovRad / 2) * distance) / canvasH;

    return new Vector2(screen.x * worldUnitsPerPixel, screen.y * worldUnitsPerPixel);
  }

  activate(): void {
    this.active = true;
    const game = this.game;
    if (game.isClient() && this.#cameraHandle !== undefined) {
      game.renderer.setActiveCamera(this.#cameraHandle);
    }
  }

  /** Orbit-mode pitch: 45° looking down-forward. */
  static readonly #ORBIT_PITCH = Quat.fromAxisAngle({ x: 1, y: 0, z: 0 }, -Math.PI / 4);

  #onFrame(): void {
    const game = this.game;
    if (!game.isClient() || this.#cameraHandle === undefined) return;

    if (this.orbit) {
      // Orbit the focus point from above/behind at 45°.
      const distance = this.orbitDistance;
      const offset = distance * Math.SQRT1_2; // sin/cos of 45°
      const camPos = new Vec3(this.focus.x, this.focus.y + offset, this.focus.z + offset);
      game.renderer.setCameraTransform(this.#cameraHandle, camPos, Camera.#ORBIT_PITCH);
    } else {
      const t = this.interpolated;
      game.renderer.setCameraTransform(this.#cameraHandle, t.position, t.rotation);
    }

    if (this.active) game.renderer.setActiveCamera(this.#cameraHandle);
    game.renderer.updateCamera(this.#cameraHandle, {
      fov: this.fov,
      near: this.near,
      far: this.far,
    });
  }
}
