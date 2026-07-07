import {
  Entity,
  EntitySpawned,
  EntityDestroyed,
  EntityEnableChanged,
  type EntityContext,
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
