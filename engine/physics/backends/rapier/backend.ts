/**
 * Rapier3D physics backend.
 *
 * This is the ONLY file in the engine that imports Rapier directly.
 * All game code (entities, behaviors) talks exclusively to IPhysicsBackend.
 * Swapping to Jolt, Bullet, or a custom solver means replacing this file only.
 */

import RAPIER from "@rebur/vendor/rapier.ts";
import type {
  ColliderHandle as RapierColliderHandle,
  RigidBodyHandle as RapierBodyHandle,
} from "@rebur/vendor/rapier.ts";
import { Vec3 } from "../../../math/vec3.ts";
import { Quat } from "../../../math/quat.ts";
import type {
  IPhysicsBackend,
  RigidBodyHandle,
  ColliderHandle,
  CharacterControllerHandle,
  RigidBodyDesc,
  ColliderDesc,
  PhysicsShape,
  CollisionEvent,
  RaycastHit,
} from "../../api.ts";

// ---------------------------------------------------------------------------
// Internal cast helpers — keeps callsites clean
// ---------------------------------------------------------------------------
const asBodyHandle = (h: number) => h as unknown as RigidBodyHandle;
const asColliderHandle = (h: number) => h as unknown as ColliderHandle;
const asCtrlHandle = (h: number) => h as unknown as CharacterControllerHandle;
const toRapierBody = (h: RigidBodyHandle) => h as unknown as RapierBodyHandle;
const toRapierCollider = (h: ColliderHandle) => h as unknown as RapierColliderHandle;

// ---------------------------------------------------------------------------
// Shape builder helper
// ---------------------------------------------------------------------------
function buildColliderDesc(shape: PhysicsShape): RAPIER.ColliderDesc {
  switch (shape.type) {
    case "box":
      return RAPIER.ColliderDesc.cuboid(
        shape.halfExtents.x,
        shape.halfExtents.y,
        shape.halfExtents.z,
      );
    case "sphere":
      return RAPIER.ColliderDesc.ball(shape.radius);
    case "capsule":
      return RAPIER.ColliderDesc.capsule(shape.halfHeight, shape.radius);
    case "cylinder":
      return RAPIER.ColliderDesc.cylinder(shape.halfHeight, shape.radius);
    default: {
      const _exhaustive: never = shape;
      throw new Error(`Unknown physics shape: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Rapier3D backend implementation
// ---------------------------------------------------------------------------
export class RapierPhysicsBackend implements IPhysicsBackend {
  enabled = true;

  readonly #world: RAPIER.World;
  readonly #events: RAPIER.EventQueue;

  /** entityRef → rapier body handle */
  readonly #refToBody = new Map<string, RapierBodyHandle>();
  /** rapier body handle → entityRef */
  readonly #bodyToRef = new Map<RapierBodyHandle, string>();
  /** entityRef → rapier collider handle (first collider) */
  readonly #refToCollider = new Map<string, RapierColliderHandle>();
  /** rapier collider handle → entityRef */
  readonly #colliderToRef = new Map<RapierColliderHandle, string>();

  /** counter for character controller identity (Rapier KCC is index-based) */
  #ctrlCounter = 0;
  readonly #ctrls = new Map<
    CharacterControllerHandle,
    { ctrl: RAPIER.KinematicCharacterController; entityRef: string }
  >();

  readonly #pendingCollisions: CollisionEvent[] = [];

  readonly #tps: number;

  get tickDelta(): number {
    return 1000 / this.#tps;
  }

  constructor(gravity = { x: 0, y: -9.81, z: 0 }, tps = 60) {
    this.#tps = tps;
    this.#world = new RAPIER.World(gravity);
    this.#world.integrationParameters.dt = 1 / tps;
    this.#events = new RAPIER.EventQueue(true);
  }

  // ---- Simulation --------------------------------------------------------

  tick(): void {
    if (!this.enabled) return;
    this.#world.step(this.#events);
    this.#drainEvents();
  }

  #drainEvents(): void {
    this.#events.drainCollisionEvents((h1, h2, started) => {
      const ref1 = this.#colliderToRef.get(h1);
      const ref2 = this.#colliderToRef.get(h2);
      if (!ref1 || !ref2) return;

      const c1 = this.#world.getCollider(h1);
      const c2 = this.#world.getCollider(h2);

      let normal1 = { x: 0, y: 1, z: 0 };
      let normal2 = { x: 0, y: -1, z: 0 };
      let contact1 = { x: 0, y: 0, z: 0 };
      let contact2 = { x: 0, y: 0, z: 0 };

      this.#world.narrowPhase.contactPair(h1, h2, (manifold, flipped) => {
        const ln1 = manifold.localNormal1();
        const ln2 = manifold.localNormal2();
        if (flipped) {
          normal1 = { x: ln2.x, y: ln2.y, z: ln2.z };
          normal2 = { x: ln1.x, y: ln1.y, z: ln1.z };
        } else {
          normal1 = { x: ln1.x, y: ln1.y, z: ln1.z };
          normal2 = { x: ln2.x, y: ln2.y, z: ln2.z };
        }
        if (manifold.numSolverContacts() > 0) {
          const pt = manifold.solverContactPoint(0);
          contact1 = { x: pt.x, y: pt.y, z: pt.z };
          contact2 = { x: pt.x, y: pt.y, z: pt.z };
        }
      });

      this.#pendingCollisions.push({
        entityRef1: ref1,
        entityRef2: ref2,
        started,
        normal1,
        normal2,
        contact1,
        contact2,
        force: { x: 0, y: 0, z: 0 },
      });
    });
  }

  drainCollisionEvents(): CollisionEvent[] {
    return this.#pendingCollisions.splice(0);
  }

  // ---- Rigid bodies ------------------------------------------------------

  createBody(entityRef: string, desc: RigidBodyDesc): RigidBodyHandle {
    let rDesc: RAPIER.RigidBodyDesc;
    switch (desc.type) {
      case "dynamic":              rDesc = RAPIER.RigidBodyDesc.dynamic();                   break;
      case "fixed":                rDesc = RAPIER.RigidBodyDesc.fixed();                     break;
      case "kinematic-position":   rDesc = RAPIER.RigidBodyDesc.kinematicPositionBased();    break;
      case "kinematic-velocity":   rDesc = RAPIER.RigidBodyDesc.kinematicVelocityBased();    break;
    }

    if (desc.position)
      rDesc.setTranslation(desc.position.x, desc.position.y, desc.position.z);
    if (desc.rotation)
      rDesc.setRotation({ x: desc.rotation.x, y: desc.rotation.y, z: desc.rotation.z, w: desc.rotation.w });
    if (desc.gravityScale !== undefined)   rDesc.setGravityScale(desc.gravityScale);
    if (desc.linearDamping !== undefined)  rDesc.setLinearDamping(desc.linearDamping);
    if (desc.angularDamping !== undefined) rDesc.setAngularDamping(desc.angularDamping);
    if (desc.ccd)                          rDesc.setCcdEnabled(true);

    const body = this.#world.createRigidBody(rDesc);
    const handle = body.handle as unknown as RapierBodyHandle;
    this.#refToBody.set(entityRef, handle);
    this.#bodyToRef.set(handle, entityRef);
    return asBodyHandle(handle as unknown as number);
  }

  destroyBody(handle: RigidBodyHandle): void {
    const rapierHandle = toRapierBody(handle);
    const body = this.#world.getRigidBody(rapierHandle);
    if (body) {
      const ref = this.#bodyToRef.get(rapierHandle);
      if (ref) this.#refToBody.delete(ref);
      this.#bodyToRef.delete(rapierHandle);
      this.#world.removeRigidBody(body);
    }
  }

  getBodyPosition(handle: RigidBodyHandle): Vec3 {
    const t = this.#world.getRigidBody(toRapierBody(handle))?.translation();
    return t ? new Vec3(t.x, t.y, t.z) : new Vec3();
  }

  setBodyPosition(handle: RigidBodyHandle, pos: { x: number; y: number; z: number }, wakeUp = true): void {
    this.#world.getRigidBody(toRapierBody(handle))?.setTranslation({ x: pos.x, y: pos.y, z: pos.z }, wakeUp);
  }

  getBodyRotation(handle: RigidBodyHandle): Quat {
    const r = this.#world.getRigidBody(toRapierBody(handle))?.rotation();
    return r ? new Quat(r.x, r.y, r.z, r.w) : new Quat();
  }

  setBodyRotation(handle: RigidBodyHandle, rot: { x: number; y: number; z: number; w: number }, wakeUp = true): void {
    this.#world.getRigidBody(toRapierBody(handle))?.setRotation({ x: rot.x, y: rot.y, z: rot.z, w: rot.w }, wakeUp);
  }

  getBodyLinearVelocity(handle: RigidBodyHandle): Vec3 {
    const v = this.#world.getRigidBody(toRapierBody(handle))?.linvel();
    return v ? new Vec3(v.x, v.y, v.z) : new Vec3();
  }

  setBodyLinearVelocity(handle: RigidBodyHandle, vel: { x: number; y: number; z: number }, wakeUp = true): void {
    this.#world.getRigidBody(toRapierBody(handle))?.setLinvel({ x: vel.x, y: vel.y, z: vel.z }, wakeUp);
  }

  getBodyAngularVelocity(handle: RigidBodyHandle): Vec3 {
    const v = this.#world.getRigidBody(toRapierBody(handle))?.angvel();
    return v ? new Vec3(v.x, v.y, v.z) : new Vec3();
  }

  setBodyAngularVelocity(handle: RigidBodyHandle, vel: { x: number; y: number; z: number }, wakeUp = true): void {
    this.#world.getRigidBody(toRapierBody(handle))?.setAngvel({ x: vel.x, y: vel.y, z: vel.z }, wakeUp);
  }

  applyImpulse(handle: RigidBodyHandle, impulse: { x: number; y: number; z: number }, wakeUp = true): void {
    this.#world.getRigidBody(toRapierBody(handle))?.applyImpulse({ x: impulse.x, y: impulse.y, z: impulse.z }, wakeUp);
  }

  applyForce(handle: RigidBodyHandle, force: { x: number; y: number; z: number }, wakeUp = true): void {
    this.#world.getRigidBody(toRapierBody(handle))?.addForce({ x: force.x, y: force.y, z: force.z }, wakeUp);
  }

  applyTorqueImpulse(handle: RigidBodyHandle, torque: { x: number; y: number; z: number }, wakeUp = true): void {
    this.#world.getRigidBody(toRapierBody(handle))?.applyTorqueImpulse({ x: torque.x, y: torque.y, z: torque.z }, wakeUp);
  }

  setBodyGravityScale(handle: RigidBodyHandle, scale: number, wakeUp = true): void {
    this.#world.getRigidBody(toRapierBody(handle))?.setGravityScale(scale, wakeUp);
  }

  wakeUp(handle: RigidBodyHandle): void {
    this.#world.getRigidBody(toRapierBody(handle))?.wakeUp();
  }

  isSleeping(handle: RigidBodyHandle): boolean {
    return this.#world.getRigidBody(toRapierBody(handle))?.isSleeping() ?? false;
  }

  // ---- Colliders ---------------------------------------------------------

  createCollider(entityRef: string, desc: ColliderDesc, bodyHandle?: RigidBodyHandle): ColliderHandle {
    const cDesc = buildColliderDesc(desc.shape);
    if (desc.isSensor)                cDesc.setSensor(true);
    if (desc.mass !== undefined)      cDesc.setMass(desc.mass);
    if (desc.restitution !== undefined) cDesc.setRestitution(desc.restitution);
    if (desc.friction !== undefined)  cDesc.setFriction(desc.friction);
    if (desc.activeEvents) {
      cDesc.setActiveEvents(
        RAPIER.ActiveEvents.COLLISION_EVENTS | RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS,
      );
      cDesc.setActiveCollisionTypes(
        RAPIER.ActiveCollisionTypes.DEFAULT |
        RAPIER.ActiveCollisionTypes.KINEMATIC_FIXED |
        RAPIER.ActiveCollisionTypes.FIXED_FIXED,
      );
    }

    const body = bodyHandle !== undefined
      ? this.#world.getRigidBody(toRapierBody(bodyHandle))
      : undefined;

    const collider = body
      ? this.#world.createCollider(cDesc, body)
      : this.#world.createCollider(cDesc);

    const rHandle = collider.handle as unknown as RapierColliderHandle;
    this.#refToCollider.set(entityRef, rHandle);
    this.#colliderToRef.set(rHandle, entityRef);
    return asColliderHandle(rHandle as unknown as number);
  }

  destroyCollider(handle: ColliderHandle): void {
    const rHandle = toRapierCollider(handle);
    const collider = this.#world.getCollider(rHandle);
    if (collider) {
      const ref = this.#colliderToRef.get(rHandle);
      if (ref) this.#refToCollider.delete(ref);
      this.#colliderToRef.delete(rHandle);
      this.#world.removeCollider(collider, false);
    }
  }

  setColliderTranslation(handle: ColliderHandle, pos: { x: number; y: number; z: number }): void {
    this.#world.getCollider(toRapierCollider(handle))?.setTranslation({ x: pos.x, y: pos.y, z: pos.z });
  }

  setColliderRotation(handle: ColliderHandle, rot: { x: number; y: number; z: number; w: number }): void {
    this.#world.getCollider(toRapierCollider(handle))?.setRotation({ x: rot.x, y: rot.y, z: rot.z, w: rot.w });
  }

  setColliderShape(handle: ColliderHandle, shape: PhysicsShape): void {
    const collider = this.#world.getCollider(toRapierCollider(handle));
    if (!collider) return;
    const desc = buildColliderDesc(shape);
    // Rapier 0.14 allows changing shape via setShape (if supported)
    // For now we update half-extents for box shapes; other shapes recreate
    switch (shape.type) {
      case "box":
        collider.setHalfExtents({ x: shape.halfExtents.x, y: shape.halfExtents.y, z: shape.halfExtents.z });
        break;
      case "sphere":
        collider.setRadius(shape.radius);
        break;
      case "capsule":
      case "cylinder":
        // Shape change not directly supported in 0.14; no-op for now
        break;
    }
  }

  setColliderEnabled(handle: ColliderHandle, enabled: boolean): void {
    this.#world.getCollider(toRapierCollider(handle))?.setEnabled(enabled);
  }

  setColliderSensor(handle: ColliderHandle, sensor: boolean): void {
    this.#world.getCollider(toRapierCollider(handle))?.setSensor(sensor);
  }

  // ---- Character controller ----------------------------------------------

  createCharacterController(entityRef: string, offset = 0.01): CharacterControllerHandle {
    const ctrl = this.#world.createCharacterController(offset);
    ctrl.enableSnapToGround(0.3);
    ctrl.setApplyImpulsesToDynamicBodies(true);
    const id = this.#ctrlCounter++ as unknown as CharacterControllerHandle;
    this.#ctrls.set(id, { ctrl, entityRef });
    return id;
  }

  destroyCharacterController(handle: CharacterControllerHandle): void {
    const entry = this.#ctrls.get(handle);
    if (entry) {
      this.#world.removeCharacterController(entry.ctrl);
      this.#ctrls.delete(handle);
    }
  }

  moveCharacter(
    ctrlHandle: CharacterControllerHandle,
    colliderHandle: ColliderHandle,
    desiredMovement: { x: number; y: number; z: number },
    _delta: number,
  ): Vec3 {
    const entry = this.#ctrls.get(ctrlHandle);
    const collider = this.#world.getCollider(toRapierCollider(colliderHandle));
    if (!entry || !collider) return new Vec3();

    entry.ctrl.computeColliderMovement(collider, {
      x: desiredMovement.x,
      y: desiredMovement.y,
      z: desiredMovement.z,
    });
    const m = entry.ctrl.computedMovement();
    return new Vec3(m.x, m.y, m.z);
  }

  isGrounded(handle: CharacterControllerHandle): boolean {
    return this.#ctrls.get(handle)?.ctrl.computedGrounded() ?? false;
  }

  // ---- Queries -----------------------------------------------------------

  castRay(
    origin: { x: number; y: number; z: number },
    direction: { x: number; y: number; z: number },
    maxDistance: number,
    excludeEntityRef?: string,
  ): RaycastHit | undefined {
    const ray = new RAPIER.Ray(origin, direction);
    const excludeHandle = excludeEntityRef
      ? this.#refToCollider.get(excludeEntityRef)
      : undefined;

    const hit = this.#world.castRayAndGetNormal(
      ray,
      maxDistance,
      true,
      undefined,
      undefined,
      undefined,
      undefined,
      excludeHandle !== undefined
        ? (c) => (c.handle as unknown as RapierColliderHandle) !== excludeHandle
        : undefined,
    );

    if (!hit) return undefined;

    const ref = this.#colliderToRef.get(hit.collider.handle as unknown as RapierColliderHandle);
    if (!ref) return undefined;

    const point = {
      x: origin.x + direction.x * hit.timeOfImpact,
      y: origin.y + direction.y * hit.timeOfImpact,
      z: origin.z + direction.z * hit.timeOfImpact,
    };

    return {
      entityRef: ref,
      point,
      normal: { x: hit.normal.x, y: hit.normal.y, z: hit.normal.z },
      distance: hit.timeOfImpact,
    };
  }

  overlapShape(shape: PhysicsShape, pos: { x: number; y: number; z: number }, rot: { x: number; y: number; z: number; w: number }): string[] {
    const refs: string[] = [];
    const cDesc = buildColliderDesc(shape);
    const shapeObj = cDesc.shape;

    this.#world.intersectionsWithShape(
      { x: pos.x, y: pos.y, z: pos.z },
      { x: rot.x, y: rot.y, z: rot.z, w: rot.w },
      shapeObj,
      (collider) => {
        const ref = this.#colliderToRef.get(collider.handle as unknown as RapierColliderHandle);
        if (ref) refs.push(ref);
        return true; // continue
      },
    );

    return refs;
  }

  // ---- World settings ----------------------------------------------------

  setGravity(gravity: { x: number; y: number; z: number }): void {
    this.#world.gravity = { x: gravity.x, y: gravity.y, z: gravity.z };
  }

  // ---- Entity ref lookup -------------------------------------------------

  lookupEntityRef(colliderHandle: ColliderHandle): string | undefined {
    return this.#colliderToRef.get(toRapierCollider(colliderHandle));
  }

  lookupEntityRefByBody(bodyHandle: RigidBodyHandle): string | undefined {
    return this.#bodyToRef.get(toRapierBody(bodyHandle));
  }

  // ---- Lifecycle ---------------------------------------------------------

  dispose(): void {
    this.#events.free();
    this.#world.free();
  }
}
