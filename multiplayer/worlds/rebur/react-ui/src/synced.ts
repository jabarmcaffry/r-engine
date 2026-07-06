import { Behavior, syncedValue } from "@rebur/engine";

export default class Synced extends Behavior {
  @syncedValue()
  count: number = 0
}
