import type { Vector2 } from "@rebur/engine";
import { Entity, exclusiveSignalType } from "@rebur/engine";

export class EntityCollision {
  constructor(
    public readonly started: boolean,
    public readonly other: Entity,
    /**
     * Point of contact in world space.
     */
    public readonly contactPoint: Vector2,
    public readonly normal: Vector2,
    public readonly force: Vector2,
  ) {}
  [exclusiveSignalType] = Entity;
}
