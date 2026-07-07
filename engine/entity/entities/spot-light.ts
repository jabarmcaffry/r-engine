import {
  Entity,
  EntitySpawned,
  EntityDestroyed,
  EntityEnableChanged,
  type EntityContext,
} from "@rebur/engine";
import type { LightHandle } from "../../renderer/api.ts";

export class SpotLight extends Entity {
  static {
    Entity.registerType(this, "@core");
  }

  static readonly icon = "🔦";

  color: number = 0xffffff;
  intensity: number = 1;
  angle: number = Math.PI / 6;
  penumbra: number = 0.1;
  distance: number = 0;
  decay: number = 2;

  #lightHandle: LightHandle | undefined;

  get bounds() { return undefined; }

  constructor(ctx: EntityContext) {
    super(ctx);

    this.defineValue(SpotLight, "color", { description: "Light color (hex)." });
    this.defineValue(SpotLight, "intensity", { description: "Light intensity." });
    this.defineValue(SpotLight, "angle", { description: "Cone half-angle (radians)." });
    this.defineValue(SpotLight, "penumbra", { description: "Soft edge fraction 0–1." });
    this.defineValue(SpotLight, "distance", { description: "Max range (0 = infinite)." });
    this.defineValue(SpotLight, "decay", { description: "Attenuation exponent." });

    this.on(EntitySpawned, () => {
      const game = this.game;
      if (!game.isClient()) return;
      this.#lightHandle = game.renderer.createLight(this.ref, {
        type: "spot",
        color: this.color,
        intensity: this.intensity,
        angle: this.angle,
        penumbra: this.penumbra,
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
      type: "spot",
      color: this.color,
      intensity: this.intensity,
      angle: this.angle,
      penumbra: this.penumbra,
      distance: this.distance,
      decay: this.decay,
    });
  }
}
