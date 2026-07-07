import type { Vec3, IVec3 } from "../math/vec3.ts";
import type { Quat, IQuat } from "../math/quat.ts";

// ---------------------------------------------------------------------------
// Opaque handle types — game code holds these, never touches backend objects.
// Swapping backends (Rapier → Jolt → custom) never breaks callers.
// ---------------------------------------------------------------------------
export type RigidBodyHandle = number & { readonly _brand: "RigidBodyHandle" };
export type ColliderHandle = number & { readonly _brand: "ColliderHandle" };
export type CharacterControllerHandle = number & { readonly _brand: "CharacterControllerHandle" };

// ---------------------------------------------------------------------------
// Descriptor types (pure data, no backend coupling)
// ---------------------------------------------------------------------------
export type RigidBodyType =
  | "dynamic"
  | "fixed"
  | "kinematic-position"
  | "kinematic-velocity";

export type PhysicsShape =
  | { type: "box"; halfExtents: IVec3 }
  | { type: "sphere"; radius: number }
  | { type: "capsule"; halfHeight: number; radius: number }
  | { type: "cylinder"; halfHeight: number; radius: number };

export interface RigidBodyDesc {
  type: RigidBodyType;
  position?: IVec3;
  rotation?: IQuat;
  gravityScale?: number;
  linearDamping?: number;
  angularDamping?: number;
  ccd?: boolean;
}

export interface ColliderDesc {
  shape: PhysicsShape;
  isSensor?: boolean;
  mass?: number;
  restitution?: number;
  friction?: number;
  activeEvents?: boolean;
}

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------
export interface CollisionEvent {
  entityRef1: string;
  entityRef2: string;
  started: boolean;
  normal1: IVec3;
  normal2: IVec3;
  contact1: IVec3;
  contact2: IVec3;
  force: IVec3;
}

export interface RaycastHit {
  entityRef: string;
  point: IVec3;
  normal: IVec3;
  distance: number;
}

// ---------------------------------------------------------------------------
// The contract every physics backend must fulfill.
// Enemy / Player / Vehicle / Weapon / AI code imports ONLY this interface.
// ---------------------------------------------------------------------------
export interface IPhysicsBackend {
  enabled: boolean;

  /** Milliseconds per physics step (1000 / TPS). Matches what Time expects. */
  readonly tickDelta: number;

  // ---- Simulation --------------------------------------------------------
  tick(): void;

  // ---- Rigid bodies ------------------------------------------------------
  createBody(entityRef: string, desc: RigidBodyDesc): RigidBodyHandle;
  destroyBody(handle: RigidBodyHandle): void;

  getBodyPosition(handle: RigidBodyHandle): Vec3;
  setBodyPosition(handle: RigidBodyHandle, pos: IVec3, wakeUp?: boolean): void;
  getBodyRotation(handle: RigidBodyHandle): Quat;
  setBodyRotation(handle: RigidBodyHandle, rot: IQuat, wakeUp?: boolean): void;
  getBodyLinearVelocity(handle: RigidBodyHandle): Vec3;
  setBodyLinearVelocity(handle: RigidBodyHandle, vel: IVec3, wakeUp?: boolean): void;
  getBodyAngularVelocity(handle: RigidBodyHandle): Vec3;
  setBodyAngularVelocity(handle: RigidBodyHandle, vel: IVec3, wakeUp?: boolean): void;

  applyImpulse(handle: RigidBodyHandle, impulse: IVec3, wakeUp?: boolean): void;
  applyForce(handle: RigidBodyHandle, force: IVec3, wakeUp?: boolean): void;
  applyTorqueImpulse(handle: RigidBodyHandle, torque: IVec3, wakeUp?: boolean): void;

  setBodyGravityScale(handle: RigidBodyHandle, scale: number, wakeUp?: boolean): void;
  wakeUp(handle: RigidBodyHandle): void;
  isSleeping(handle: RigidBodyHandle): boolean;

  // ---- Colliders ---------------------------------------------------------
  createCollider(
    entityRef: string,
    desc: ColliderDesc,
    bodyHandle?: RigidBodyHandle,
  ): ColliderHandle;
  destroyCollider(handle: ColliderHandle): void;

  setColliderTranslation(handle: ColliderHandle, pos: IVec3): void;
  setColliderRotation(handle: ColliderHandle, rot: IQuat): void;
  setColliderShape(handle: ColliderHandle, shape: PhysicsShape): void;
  setColliderEnabled(handle: ColliderHandle, enabled: boolean): void;
  setColliderSensor(handle: ColliderHandle, sensor: boolean): void;

  // ---- Character controller ----------------------------------------------
  createCharacterController(entityRef: string, offset: number): CharacterControllerHandle;
  destroyCharacterController(handle: CharacterControllerHandle): void;
  moveCharacter(
    ctrlHandle: CharacterControllerHandle,
    colliderHandle: ColliderHandle,
    desiredMovement: IVec3,
    delta: number,
  ): Vec3;
  isGrounded(handle: CharacterControllerHandle): boolean;

  // ---- Queries -----------------------------------------------------------
  castRay(
    origin: IVec3,
    direction: IVec3,
    maxDistance: number,
    excludeEntityRef?: string,
  ): RaycastHit | undefined;
  overlapShape(shape: PhysicsShape, pos: IVec3, rot: IQuat): string[];

  // ---- Debug ---------------------------------------------------------------
  /** Wireframe line data for all colliders (pairs of vertices + RGBA colors). */
  debugRender(): { vertices: Float32Array; colors: Float32Array };

  // ---- World settings ----------------------------------------------------
  setGravity(gravity: IVec3): void;

  // ---- Events (drained each tick by the engine) --------------------------
  drainCollisionEvents(): CollisionEvent[];

  // ---- Entity ref lookup (engine internals only) -------------------------
  lookupEntityRef(colliderHandle: ColliderHandle): string | undefined;
  lookupEntityRefByBody(bodyHandle: RigidBodyHandle): string | undefined;

  dispose(): void;
}
