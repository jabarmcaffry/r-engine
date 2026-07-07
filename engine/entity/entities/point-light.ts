import {
  Entity,
  EntitySpawned,
  EntityDestroyed,
  EntityEnableChanged,
  type EntityContext,
} from "@rebur/engine";
import type { LightHandle } from "../../renderer/api.ts";

export class PointLight extends Entity {
  static {
    Entity.registerType(this, "@core");
  }

  static readonly icon = "🔆";

  color: number = 0xffffff;
  intensity: number = 1;
  distance: number = 0;
  decay: number = 2;

  #lightHandle: LightHandle | undefined;

  get bounds() { return undefined; }

  constructor(ctx: EntityContext) {
    super(ctx);

    this.defineValue(PointLight, "color", { description: "Light color (hex)." });
    this.defineValue(PointLight, "intensity", { description: "Light intensity." });
    this.defineValue(PointLight, "distance", { description: "Max range (0 = infinite)." });
    this.defineValue(PointLight, "decay", { description: "Attenuation exponent." });

    this.on(EntitySpawned, () => {
      const game = this.game;
      if (!game.isClient()) return;
      this.#lightHandle = game.renderer.createLight(this.ref, {
        type: "point",
        color: this.color,
        intensity: this.intensity,
        distance: this.distance,
        decay: this.decay,
      });
    });

    this.on(EntityDestroyed, () => {
      const game = this.game;
      if (!game.isClient() || this.#lightHandle === undefined) return;
      game.renderer.destroyLight(this.#lightHandle);
    });

    this.on(EntityEnableChanged, ({ enabled }) => {
      const game = this.game;
      if (!game.isClient() || this.#lightHandle === undefined) return;
      game.renderer.setLightVisible(this.#lightHandle, enabled);
    });
  }

  onFrame(): void {
    const game = this.game;
    if (!game.isClient() || this.#lightHandle === undefined) return;
    const t = this.globalTransform;
    game.renderer.setLightTransform(this.#lightHandle, t.position, t.rotation);
    game.renderer.updateLight(this.#lightHandle, {
      type: "point",
      color: this.color,
      intensity: this.intensity,
      distance: this.distance,
      decay: this.decay,
    });
  }
}
