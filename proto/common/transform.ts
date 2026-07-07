import { Entity, ITransform } from "@rebur/engine";

export const transformFor = (entity: Entity): ITransform => ({
  position: entity.globalTransform.position.bare(),
  rotation: entity.globalTransform.rotation.bare(),
  scale: entity.globalTransform.scale.bare(),
});

const almostEq = (a: number, b: number, epsilon: number) => Math.abs(a - b) < epsilon;

export const transformsEq = (a: ITransform, b: ITransform) =>
  almostEq(a.position.x, b.position.x, 0.001) &&
  almostEq(a.position.y, b.position.y, 0.001) &&
  almostEq(a.position.z, b.position.z, 0.001) &&
  almostEq(a.rotation.x, b.rotation.x, 0.0001) &&
  almostEq(a.rotation.y, b.rotation.y, 0.0001) &&
  almostEq(a.rotation.z, b.rotation.z, 0.0001) &&
  almostEq(a.rotation.w, b.rotation.w, 0.0001) &&
  a.scale.x === b.scale.x &&
  a.scale.y === b.scale.y &&
  a.scale.z === b.scale.z;
