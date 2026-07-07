// 3D TRS (translate-rotate-scale) transform composition.
//
// Conventions: column-vector convention, `world = parent ∘ local`, i.e.
//   worldPos = parentPos + parentRot * (parentScale ⊙ localPos)
//   worldRot = parentRot * localRot
//   worldScale = parentScale ⊙ localScale   (component-wise; assumes no shear)
import { Quat } from "./quat.ts";
import { Transform } from "./entity-transform.ts";
import { Vec3, type IVec3 } from "./vec3.ts";

export function transformLocalToWorld(
  parentWorldTransform: Transform,
  localTransform: Transform,
): Transform {
  const a = parentWorldTransform;
  const b = localTransform;

  const scaled = new Vec3(
    b.position.x * a.scale.x,
    b.position.y * a.scale.y,
    b.position.z * a.scale.z,
  );
  const rotated = a.rotation.rotateVec3(scaled);

  return new Transform({
    position: new Vec3(rotated).add(a.position),
    rotation: a.rotation.multiply(b.rotation).normalized(),
    scale: new Vec3(a.scale.x * b.scale.x, a.scale.y * b.scale.y, a.scale.z * b.scale.z),
  });
}

export function transformWorldToLocal(
  parentWorldTransform: Transform,
  worldTransform: Transform,
): Transform {
  const a = parentWorldTransform;
  const b = worldTransform;

  const invRotation = a.rotation.normalized().conjugate();
  const delta = b.position.sub(a.position);
  const unrotated = invRotation.rotateVec3(delta);

  return new Transform({
    position: new Vec3(
      unrotated.x / (a.scale.x || 1),
      unrotated.y / (a.scale.y || 1),
      unrotated.z / (a.scale.z || 1),
    ),
    rotation: invRotation.multiply(b.rotation).normalized(),
    scale: new Vec3(
      b.scale.x / (a.scale.x || 1),
      b.scale.y / (a.scale.y || 1),
      b.scale.z / (a.scale.z || 1),
    ),
  });
}

export function pointLocalToWorld(worldTransform: Transform, localPoint: IVec3): Vec3 {
  const t = worldTransform;
  const scaled = new Vec3(
    localPoint.x * t.scale.x,
    localPoint.y * t.scale.y,
    localPoint.z * t.scale.z,
  );
  return new Vec3(t.rotation.rotateVec3(scaled)).add(t.position);
}

export function pointWorldToLocal(worldTransform: Transform, worldPoint: IVec3): Vec3 {
  const t = worldTransform;
  const invRotation = t.rotation.normalized().conjugate();
  const delta = new Vec3(worldPoint).sub(t.position);
  const unrotated = invRotation.rotateVec3(delta);
  return new Vec3(
    unrotated.x / (t.scale.x || 1),
    unrotated.y / (t.scale.y || 1),
    unrotated.z / (t.scale.z || 1),
  );
}

/** Rotate a direction vector from local space to world space (ignores position/scale). */
export function directionLocalToWorld(worldTransform: Transform, localDir: IVec3): Vec3 {
  return new Vec3(worldTransform.rotation.rotateVec3(localDir));
}

/** Rotate a direction vector from world space to local space (ignores position/scale). */
export function directionWorldToLocal(worldTransform: Transform, worldDir: IVec3): Vec3 {
  return new Vec3(worldTransform.rotation.normalized().conjugate().rotateVec3(worldDir));
}

export { Quat, Transform, Vec3 };
