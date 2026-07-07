import { Entity, exclusiveSignalType } from "@rebur/engine";
import { Vec3 } from "../math/vec3.ts";

/**
 * Fired on each entity involved in a collision.
 * `other` is the opposing entity.
 * contactPoint, normal, force are in world space.
 */
export class EntityCollision {
  constructor(
    public readonly started: boolean,
    public readonly other: Entity,
    /** Point of contact in world space. */
    public readonly contactPoint: Vec3,
    public readonly normal: Vec3,
    public readonly force: Vec3,
  ) {}
  [exclusiveSignalType] = Entity;
}
