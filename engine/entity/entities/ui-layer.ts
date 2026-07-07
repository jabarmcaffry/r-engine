/**
 * Stub — UILayer was a PIXI 2D overlay.
 * The 3D migration replaces it with a proper HTML/CSS layer in a future step.
 * This stub keeps UIBehavior and behavior.ts compiling without PIXI.
 */
import { Entity, type EntityContext } from "@rebur/engine";

export class UILayer extends Entity {
  static {
    Entity.registerType(this, "@core");
  }
  static readonly icon = "🗂";
  get bounds() { return undefined; }
  constructor(ctx: EntityContext) { super(ctx); }
}
