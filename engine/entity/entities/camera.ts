import {
  Entity,
  EntitySpawned,
  EntityDestroyed,
  EntityEnableChanged,
  type EntityContext,
  type Game,
  Vector2,
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

  #cameraHandle: CameraHandle | undefined;

  get bounds() { return undefined; }

  constructor(ctx: EntityContext) {
    super(ctx);

    this.defineValue(Camera, "active", { description: "Whether this camera renders the scene." });
    this.defineValue(Camera, "fov", { description: "Vertical field of view in degrees." });
    this.defineValue(Camera, "near", { description: "Near clipping plane." });
    this.defineValue(Camera, "far", { description: "Far clipping plane." });

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
   * Used by inputs, behaviors, and editor code that need the active viewpoint.
   */
  static getActive(game: Game): Camera | undefined {
    return game.entities.lookupByType(Camera).find(c => c.active);
  }

  /**
   * Convert a screen-space point to a world-space position.
   *
   * TODO: 3D migration — implement Three.js Raycaster for true world coordinates.
   * For now this returns the screen position so mouse/click events continue to fire
   * and UI hit-testing works while the proper 3D raycast is implemented.
   */
  screenToWorld(screen: { x: number; y: number }): Vector2 | undefined {
    return new Vector2(screen.x, screen.y);
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
    const t = this.globalTransform;
    game.renderer.setCameraTransform(this.#cameraHandle, t.position, t.rotation);
    if (this.active) game.renderer.setActiveCamera(this.#cameraHandle);
    game.renderer.updateCamera(this.#cameraHandle, { fov: this.fov, near: this.near, far: this.far });
  }
}
