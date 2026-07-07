/**
 * Stub — UIPanel was a PIXI 2D panel.
 * The 3D migration replaces it with proper HTML/CSS in a future step.
 */
import { Entity, type EntityContext } from "@rebur/engine";

export class UIPanel extends Entity {
  static {
    Entity.registerType(this, "@core");
  }
  static readonly icon = "🗃";
  get bounds() { return undefined; }
  constructor(ctx: EntityContext) { super(ctx); }
}
