import {
  Entity,
  EntitySpawned,
  EntityDestroyed,
  type EntityContext,
} from "@rebur/engine";
import type { ColliderHandle, CharacterControllerHandle, PhysicsShape } from "../../physics/api.ts";
import { Vec3 } from "../../math/vec3.ts";

export class CharacterController extends Entity {
  static {
    Entity.registerType(this, "@core");
  }

  static readonly icon: string = "🚶";

  /** Skin offset above ground to prevent snagging. */
  offset: number = 0.01;
  radius: number = 0.5;
  height: number = 1.8;

  #colliderHandle: ColliderHandle | undefined;
  #ctrlHandle: CharacterControllerHandle | undefined;

  get bounds() { return undefined; }
  get colliderHandle(): ColliderHandle | undefined { return this.#colliderHandle; }

  constructor(ctx: EntityContext) {
    super(ctx);

    this.defineValue(CharacterController, "offset", { description: "Skin offset above ground." });
    this.defineValue(CharacterController, "radius", { description: "Capsule radius." });
    this.defineValue(CharacterController, "height", { description: "Capsule height." });

    this.on(EntitySpawned, () => {
      const shape: PhysicsShape = {
        type: "capsule",
        halfHeight: this.height / 2,
        radius: this.radius,
      };
      this.#colliderHandle = this.game.physics.createCollider(
        this.ref,
        { shape, mass: 1, friction: 0.7, activeEvents: true },
        undefined,
      );
      const t = this.globalTransform;
      this.game.physics.setColliderTranslation(this.#colliderHandle, t.position);
      this.game.physics.setColliderRotation(this.#colliderHandle, t.rotation);

      this.#ctrlHandle = this.game.physics.createCharacterController(this.ref, this.offset);
    });

    this.on(EntityDestroyed, () => {
      if (this.#ctrlHandle !== undefined) {
        this.game.physics.destroyCharacterController(this.#ctrlHandle);
        this.#ctrlHandle = undefined;
      }
      if (this.#colliderHandle !== undefined) {
        this.game.physics.destroyCollider(this.#colliderHandle);
        this.#colliderHandle = undefined;
      }
    });
  }

  /**
   * Move by desired velocity (units/s). Returns actual velocity after collision.
   */
  move(desiredVelocity: Vec3, delta: number): Vec3 {
    if (this.#ctrlHandle === undefined || this.#colliderHandle === undefined) return Vec3.ZERO.clone();

    const desired = desiredVelocity.scale(delta);
    const actual = this.game.physics.moveCharacter(
      this.#ctrlHandle,
      this.#colliderHandle,
      desired,
      delta,
    );

    const t = this.globalTransform;
    const newPos = t.position.add(actual);
    t.position.assign(newPos);
    this.game.physics.setColliderTranslation(this.#colliderHandle, newPos);

    return actual.scale(1 / delta);
  }

  get isGrounded(): boolean {
    if (this.#ctrlHandle === undefined) return false;
    return this.game.physics.isGrounded(this.#ctrlHandle);
  }
}
