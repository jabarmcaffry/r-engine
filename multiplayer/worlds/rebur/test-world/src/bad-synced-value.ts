import { Behavior, value, Vector2 } from "@rebur/engine";

export default class BadSyncedValueBehavior extends Behavior {
  @value()
  test = Vector2.ZERO
}
