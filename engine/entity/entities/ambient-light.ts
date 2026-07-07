import {
  Entity,
  EntitySpawned,
  EntityDestroyed,
  EntityEnableChanged,
  type EntityContext,
  type ClientGame,
} from "@rebur/engine";
import type { LightHandle } from "../../renderer/api.ts";

export class AmbientLight extends Entity {
  static {
    Entity.registerType(this, "@core");
  }

  static readonly icon: string = "💡";

  color: number = 0xffffff;
  intensity: number = 0.4;

  #lightHandle: LightHandle | undefined;

  get bounds() { return undefined; }

  constructor(ctx: EntityContext) {
    super(ctx);

    this.defineValue(AmbientLight, "color", { description: "Light color (hex)." });
    this.defineValue(AmbientLight, "intensity", { description: "Light intensity." });

    this.on(EntitySpawned, () => {
      const game = this.game;
      if (!game.isClient()) return;
      this.#lightHandle = game.renderer.createLight(this.ref, {
        type: "ambient",
        color: this.color,
        intensity: this.intensity,
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
    game.renderer.updateLight(this.#lightHandle, {
      type: "ambient",
      color: this.color,
      intensity: this.intensity,
    });
  }
}
