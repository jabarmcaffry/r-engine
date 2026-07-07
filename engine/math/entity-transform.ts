import * as internal from "@rebur/engine/internal";
import { Vec3, type IVec3 } from "./vec3.ts";
import { Quat, type IQuat } from "./quat.ts";

export interface ITransform {
  position: IVec3;
  rotation: IQuat;
  scale: IVec3;
}

/** Options accepted by `setTransform` / `setGlobalTransform` — all fields optional. */
export interface TransformOptions {
  position?: IVec3;
  rotation?: IQuat;
  scale?: IVec3;
}

export class Transform implements ITransform {
  #position: Vec3;
  #rotation: Quat;
  #scale: Vec3;

  /**
   * Accepts any of:
   * - no args → identity
   * - an `ITransform` (or another `Transform`) → copies all three fields
   * - `TransformOptions` (partial ITransform) → copies provided fields, defaults for missing
   */
  constructor(source?: Partial<ITransform> | null) {
    this.#position = new Vec3(source?.position ?? Vec3.ZERO);
    this.#rotation = new Quat(source?.rotation ?? Quat.IDENTITY);
    this.#scale = new Vec3(source?.scale ?? Vec3.ONE);
  }

  get position(): Vec3 { return this.#position; }
  set position(v: IVec3) {
    this.#position.assign(v);
    this[internal.transformOnChanged]?.();
  }

  get rotation(): Quat { return this.#rotation; }
  set rotation(q: IQuat) {
    this.#rotation.assign(q);
    this[internal.transformOnChanged]?.();
  }

  get scale(): Vec3 { return this.#scale; }
  set scale(v: IVec3) {
    this.#scale.assign(v);
    this[internal.transformOnChanged]?.();
  }

  /** Back-compat shim: the old Transform had a standalone `z` layer field.
   *  In 3D it maps to `position.z`.  */
  get z(): number { return this.#position.z; }
  set z(value: number) {
    this.#position.z = value;
    this[internal.transformOnChanged]?.();
  }

  [internal.transformOnChanged]?: () => void;

  /** Force-update all fields without triggering the onChange callback. */
  [internal.transformForceUpdate](t: ITransform): void {
    this.#position.assign(t.position);
    this.#rotation.assign(t.rotation);
    this.#scale.assign(t.scale);
  }

  /** Same as transformForceUpdate — used by network interpolation. */
  [internal.transformFromNetwork](t: ITransform): void {
    this.#position.assign(t.position);
    this.#rotation.assign(t.rotation);
    this.#scale.assign(t.scale);
  }

  assign(other: Partial<ITransform>): this {
    if (other.position) this.#position.assign(other.position);
    if (other.rotation) this.#rotation.assign(other.rotation);
    if (other.scale)    this.#scale.assign(other.scale);
    this[internal.transformOnChanged]?.();
    return this;
  }

  bare(): ITransform {
    return {
      position: { x: this.#position.x, y: this.#position.y, z: this.#position.z },
      rotation: { x: this.#rotation.x, y: this.#rotation.y, z: this.#rotation.z, w: this.#rotation.w },
      scale:    { x: this.#scale.x,    y: this.#scale.y,    z: this.#scale.z },
    };
  }

  clone(): Transform {
    return new Transform({ position: this.#position, rotation: this.#rotation, scale: this.#scale });
  }

  equals(other: Partial<ITransform>, epsilon = 1e-6): boolean {
    return (
      (!other.position || this.#position.equals(other.position, epsilon)) &&
      (!other.rotation || this.#rotation.equals(other.rotation, epsilon)) &&
      (!other.scale    || this.#scale.equals(other.scale, epsilon))
    );
  }
}
