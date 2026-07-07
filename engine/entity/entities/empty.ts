import { Entity, type EntityContext } from "@rebur/engine";

/**
 * A pure transform container — no renderer or physics coupling.
 * Use as a parent/group node to organise scene hierarchy.
 */
export class Empty extends Entity {
  static {
    Entity.registerType(this, "@core");
  }

  static readonly icon = "📌";

  get bounds() { return undefined; }

  constructor(ctx: EntityContext) {
    super(ctx);
  }
}
