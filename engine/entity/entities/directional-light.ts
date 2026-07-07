import {
  Entity,
  EntitySpawned,
  EntityDestroyed,
  EntityEnableChanged,
  type EntityContext,
} from "@rebur/engine";
import type { LightHandle } from "../../renderer/api.ts";

export class DirectionalLight extends Entity {
  static {
    Entity.registerType(this, "@core");
  }

  static readonly icon: string = "☀️";

  color: number = 0xffffff;
  intensity: number = 1;
  castShadow: boolean = true;

  #lightHandle: LightHandle | undefined;

  get bounds() { return undefined; }

  constructor(ctx: EntityContext) {
    super(ctx);

    this.defineValue(DirectionalLight, "color", { description: "Light color (hex)." });
    this.defineValue(DirectionalLight, "intensity", { description: "Light intensity." });
    this.defineValue(DirectionalLight, "castShadow", { description: "Cast shadows." });

    this.on(EntitySpawned, () => {
      const game = this.game;
      if (!game.isClient()) return;
      this.#lightHandle = game.renderer.createLight(this.ref, {
        type: "directional",
        color: this.color,
        intensity: this.intensity,
        castShadow: this.castShadow,
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
      type: "directional",
      color: this.color,
      intensity: this.intensity,
      castShadow: this.castShadow,
    });
  }
}
