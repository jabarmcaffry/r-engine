import { Entity } from "@rebur/engine";
import * as internal from "@rebur/engine/internal";

// we cheat by not ticking anything underneath an InertEntity ever,
// which lets us have a LOT of stuff underneath with no impact on tick times
export class InertEntity extends Entity {
  static {
    Entity.registerType(this, "@many-entities-custom");
  }

  static icon = "⏳";

  bounds = undefined;

  [internal.submitEntityTickingOrder]() {}
}
