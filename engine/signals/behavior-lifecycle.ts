import type { Behavior } from "@rebur/engine";

export class BehaviorSpawned {
  constructor(public readonly behavior: Behavior) {}
}

export class BehaviorDescendantSpawned {
  constructor(public readonly behavior: Behavior) {}
}

export class BehaviorDestroyed {
  constructor(public readonly behavior: Behavior) {}
}

export class BehaviorDescendantDestroyed {
  constructor(public readonly behavior: Behavior) {}
}
