import { Behavior, syncedValue } from "@rebur/engine";

export default class Spawnpoint extends Behavior {
  @syncedValue()
  spawned: boolean = false;
}
