import {
  Entity,
  EntitySpawned,
  EntityDestroyed,
  EntityEnableChanged,
  type EntityContext,
} from "@rebur/engine";
import type { ColliderHandle, PhysicsShape } from "../../physics/api.ts";
import { Rigidbody } from "./rigidbody.ts";

export type ColliderShapeType = "box" | "sphere" | "capsule" | "cylinder";

export class Collider extends Entity {
  static {
    Entity.registerType(this, "@core");
  }

  static readonly icon: string = "🧱";

  shape: ColliderShapeType = "box";
  isSensor: boolean = false;
  mass: number = 1;
  restitution: number = 0;
  friction: number = 0.5;

  #colliderHandle: ColliderHandle | undefined;

  get bounds() { return undefined; }
  get colliderHandle(): ColliderHandle | undefined { return this.#colliderHandle; }

  constructor(ctx: EntityContext) {
    super(ctx);

    this.defineValue(Collider, "shape", { description: "Collision shape: box | sphere | capsule | cylinder." });
    this.defineValue(Collider, "isSensor", { description: "Trigger (no physics response) when true." });
    this.defineValue(Collider, "mass", { description: "Collider mass." });
    this.defineValue(Collider, "restitution", { description: "Bounciness 0–1." });
    this.defineValue(Collider, "friction", { description: "Surface friction." });

    this.on(EntitySpawned, () => this.#createCollider());

    this.on(EntityDestroyed, () => {
      if (this.#colliderHandle === undefined) return;
      this.game.physics.destroyCollider(this.#colliderHandle);
      this.#colliderHandle = undefined;
    });

    this.on(EntityEnableChanged, ({ enabled }) => {
      if (this.#colliderHandle !== undefined)
        this.game.physics.setColliderEnabled(this.#colliderHandle, enabled);
    });
  }

  #physicsShape(): PhysicsShape {
    const t = this.globalTransform;
    switch (this.shape) {
      case "box":
        return { type: "box", halfExtents: { x: t.scale.x / 2, y: t.scale.y / 2, z: t.scale.z / 2 } };
      case "sphere":
        return { type: "sphere", radius: Math.max(t.scale.x, t.scale.y, t.scale.z) / 2 };
      case "capsule":
        return { type: "capsule", halfHeight: t.scale.y / 2, radius: t.scale.x / 2 };
      case "cylinder":
        return { type: "cylinder", halfHeight: t.scale.y / 2, radius: t.scale.x / 2 };
    }
  }

  #createCollider(): void {
    const parentBody = this.parent instanceof Rigidbody ? this.parent : undefined;
    this.#colliderHandle = this.game.physics.createCollider(
      this.ref,
      {
        shape: this.#physicsShape(),
        isSensor: this.isSensor,
        mass: this.mass,
        restitution: this.restitution,
        friction: this.friction,
        activeEvents: true,
      },
      parentBody?.bodyHandle,
    );
    this.#syncTransform();
  }

  #syncTransform(): void {
    if (this.#colliderHandle === undefined) return;
    const t = this.globalTransform;
    this.game.physics.setColliderTranslation(this.#colliderHandle, t.position);
    this.game.physics.setColliderRotation(this.#colliderHandle, t.rotation);
  }

  onUpdate(): void {
    super.onUpdate();
    this.#syncTransform();
    if (this.#colliderHandle !== undefined)
      this.game.physics.setColliderShape(this.#colliderHandle, this.#physicsShape());
  }
}
