import {
  Entity,
  EntitySpawned,
  EntityDestroyed,
  EntityEnableChanged,
  type EntityContext,
} from "@rebur/engine";
import * as internal from "@rebur/engine/internal";
import type { RigidBodyHandle } from "../../physics/api.ts";
import { Vec3 } from "../../math/vec3.ts";
import { Quat } from "../../math/quat.ts";

export type RigidBodyTypeValue = "dynamic" | "fixed" | "kinematic-position" | "kinematic-velocity";

export class Rigidbody extends Entity {
  static {
    Entity.registerType(this, "@core");
  }

  static readonly icon = "⚙️";

  type: RigidBodyTypeValue = "dynamic";
  gravityScale: number = 1;
  linearDamping: number = 0;
  angularDamping: number = 0;
  ccd: boolean = false;

  #bodyHandle: RigidBodyHandle | undefined;

  get bounds() { return undefined; }

  /** Readable by Collider children to parent themselves to this body. */
  get bodyHandle(): RigidBodyHandle | undefined {
    return this.#bodyHandle;
  }

  constructor(ctx: EntityContext) {
    super(ctx);

    this.defineValue(Rigidbody, "type", { description: "Physics body type: dynamic | fixed | kinematic-position | kinematic-velocity." });
    this.defineValue(Rigidbody, "gravityScale", { description: "Gravity scale multiplier." });
    this.defineValue(Rigidbody, "linearDamping", { description: "Linear velocity damping." });
    this.defineValue(Rigidbody, "angularDamping", { description: "Angular velocity damping." });
    this.defineValue(Rigidbody, "ccd", { description: "Continuous collision detection." });

    this.on(EntitySpawned, () => {
      const t = this.globalTransform;
      this.#bodyHandle = this.game.physics.createBody(this.ref, {
        type: this.type,
        position: { x: t.position.x, y: t.position.y, z: t.position.z },
        rotation: { x: t.rotation.x, y: t.rotation.y, z: t.rotation.z, w: t.rotation.w },
        gravityScale: this.gravityScale,
        linearDamping: this.linearDamping,
        angularDamping: this.angularDamping,
        ccd: this.ccd,
      });
    });

    this.on(EntityDestroyed, () => {
      if (this.#bodyHandle === undefined) return;
      this.game.physics.destroyBody(this.#bodyHandle);
      this.#bodyHandle = undefined;
    });

    this.on(EntityEnableChanged, () => {
      if (this.#bodyHandle !== undefined && this.enabled) {
        this.game.physics.wakeUp(this.#bodyHandle);
      }
    });
  }

  [internal.applyNetworkInterpolation](): void {
    super[internal.applyNetworkInterpolation]();
    this.#pushTransformToPhysics();
  }

  onUpdate(): void {
    this.#pullTransformFromPhysics();
    super.onUpdate();
  }

  #pushTransformToPhysics(): void {
    if (!this.game.physics.enabled || this.#bodyHandle === undefined) return;
    const t = this.globalTransform;
    this.game.physics.setBodyPosition(this.#bodyHandle, t.position);
    this.game.physics.setBodyRotation(this.#bodyHandle, t.rotation);
  }

  #pullTransformFromPhysics(): void {
    if (!this.game.physics.enabled || this.#bodyHandle === undefined) return;
    if (this.authority === undefined && this.game.isClient()) return;

    const pos = this.game.physics.getBodyPosition(this.#bodyHandle);
    const rot = this.game.physics.getBodyRotation(this.#bodyHandle);
    this.globalTransform.position.assign(pos);
    this.globalTransform.rotation.assign(rot);
  }

  get linearVelocity(): Vec3 {
    if (this.#bodyHandle === undefined) return Vec3.ZERO.clone();
    return this.game.physics.getBodyLinearVelocity(this.#bodyHandle);
  }

  set linearVelocity(v: Vec3) {
    if (this.#bodyHandle !== undefined)
      this.game.physics.setBodyLinearVelocity(this.#bodyHandle, v);
  }

  get angularVelocity(): Vec3 {
    if (this.#bodyHandle === undefined) return Vec3.ZERO.clone();
    return this.game.physics.getBodyAngularVelocity(this.#bodyHandle);
  }

  set angularVelocity(v: Vec3) {
    if (this.#bodyHandle !== undefined)
      this.game.physics.setBodyAngularVelocity(this.#bodyHandle, v);
  }

  applyImpulse(impulse: Vec3): void {
    if (this.#bodyHandle !== undefined)
      this.game.physics.applyImpulse(this.#bodyHandle, impulse);
  }

  applyForce(force: Vec3): void {
    if (this.#bodyHandle !== undefined)
      this.game.physics.applyForce(this.#bodyHandle, force);
  }

  applyTorqueImpulse(torque: Vec3): void {
    if (this.#bodyHandle !== undefined)
      this.game.physics.applyTorqueImpulse(this.#bodyHandle, torque);
  }

  wakeUp(): void {
    if (this.#bodyHandle !== undefined)
      this.game.physics.wakeUp(this.#bodyHandle);
  }
}
