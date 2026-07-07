import type { IVec3 } from "./vec3.ts";

export interface IQuat {
  x: number;
  y: number;
  z: number;
  w: number;
}

export class Quat implements IQuat {
  x: number;
  y: number;
  z: number;
  w: number;

  static readonly IDENTITY = Object.freeze(new Quat(0, 0, 0, 1));

  constructor(x?: number, y?: number, z?: number, w?: number);
  constructor(q: IQuat);
  constructor(xOrQ: number | IQuat = 0, y = 0, z = 0, w = 1) {
    if (typeof xOrQ === "object") {
      this.x = xOrQ.x;
      this.y = xOrQ.y;
      this.z = xOrQ.z;
      this.w = xOrQ.w;
    } else {
      this.x = xOrQ;
      this.y = y;
      this.z = z;
      this.w = w;
    }
  }

  /** Create from Euler angles in radians, XYZ intrinsic order. */
  static fromEulerXYZ(ex: number, ey: number, ez: number): Quat {
    const cx = Math.cos(ex / 2), sx = Math.sin(ex / 2);
    const cy = Math.cos(ey / 2), sy = Math.sin(ey / 2);
    const cz = Math.cos(ez / 2), sz = Math.sin(ez / 2);
    return new Quat(
      sx * cy * cz + cx * sy * sz,
      cx * sy * cz - sx * cy * sz,
      cx * cy * sz + sx * sy * cz,
      cx * cy * cz - sx * sy * sz,
    );
  }

  /** Create from axis-angle. Axis must be normalized. */
  static fromAxisAngle(axis: IVec3, angle: number): Quat {
    const s = Math.sin(angle / 2);
    return new Quat(axis.x * s, axis.y * s, axis.z * s, Math.cos(angle / 2));
  }

  multiply(other: IQuat): Quat {
    const { x: ax, y: ay, z: az, w: aw } = this;
    const { x: bx, y: by, z: bz, w: bw } = other;
    return new Quat(
      aw * bx + ax * bw + ay * bz - az * by,
      aw * by - ax * bz + ay * bw + az * bx,
      aw * bz + ax * by - ay * bx + az * bw,
      aw * bw - ax * bx - ay * by - az * bz,
    );
  }

  conjugate(): Quat {
    return new Quat(-this.x, -this.y, -this.z, this.w);
  }

  inverse(): Quat {
    const lenSq = this.x ** 2 + this.y ** 2 + this.z ** 2 + this.w ** 2;
    if (lenSq === 0) return Quat.IDENTITY.clone();
    return new Quat(-this.x / lenSq, -this.y / lenSq, -this.z / lenSq, this.w / lenSq);
  }

  normalized(): Quat {
    const l = Math.sqrt(this.x ** 2 + this.y ** 2 + this.z ** 2 + this.w ** 2);
    if (l === 0) return Quat.IDENTITY.clone();
    return new Quat(this.x / l, this.y / l, this.z / l, this.w / l);
  }

  /** Spherical linear interpolation. */
  slerp(other: IQuat, t: number): Quat {
    let ox = other.x, oy = other.y, oz = other.z, ow = other.w;
    let dot = this.x * ox + this.y * oy + this.z * oz + this.w * ow;
    if (dot < 0) { ox = -ox; oy = -oy; oz = -oz; ow = -ow; dot = -dot; }
    if (dot > 0.9995) {
      return new Quat(
        this.x + t * (ox - this.x),
        this.y + t * (oy - this.y),
        this.z + t * (oz - this.z),
        this.w + t * (ow - this.w),
      ).normalized();
    }
    const angle = Math.acos(dot);
    const sinAngle = Math.sin(angle);
    const sa = Math.sin((1 - t) * angle) / sinAngle;
    const sb = Math.sin(t * angle) / sinAngle;
    return new Quat(
      sa * this.x + sb * ox,
      sa * this.y + sb * oy,
      sa * this.z + sb * oz,
      sa * this.w + sb * ow,
    );
  }

  /** Decompose to Euler angles in radians (XYZ order). */
  toEulerXYZ(): { x: number; y: number; z: number } {
    const { x, y, z, w } = this;
    return {
      x: Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y)),
      y: Math.asin(Math.max(-1, Math.min(1, 2 * (w * y - z * x)))),
      z: Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z)),
    };
  }

  /** Rotate a vector by this quaternion. */
  rotateVec3(v: IVec3): { x: number; y: number; z: number } {
    const { x: qx, y: qy, z: qz, w: qw } = this;
    const { x: vx, y: vy, z: vz } = v;
    const tx = 2 * (qy * vz - qz * vy);
    const ty = 2 * (qz * vx - qx * vz);
    const tz = 2 * (qx * vy - qy * vx);
    return {
      x: vx + qw * tx + qy * tz - qz * ty,
      y: vy + qw * ty + qz * tx - qx * tz,
      z: vz + qw * tz + qx * ty - qy * tx,
    };
  }

  clone(): Quat {
    return new Quat(this.x, this.y, this.z, this.w);
  }

  assign(other: IQuat): this {
    this.x = other.x;
    this.y = other.y;
    this.z = other.z;
    this.w = other.w;
    return this;
  }

  set(x: number, y: number, z: number, w: number): this {
    this.x = x; this.y = y; this.z = z; this.w = w;
    return this;
  }

  equals(other: IQuat, epsilon = 1e-6): boolean {
    return (
      Math.abs(this.x - other.x) < epsilon &&
      Math.abs(this.y - other.y) < epsilon &&
      Math.abs(this.z - other.z) < epsilon &&
      Math.abs(this.w - other.w) < epsilon
    );
  }

  /** Returns a plain `{x,y,z,w}` object (no prototype chain). Useful for serialisation. */
  bare(): IQuat {
    return { x: this.x, y: this.y, z: this.z, w: this.w };
  }

  toArray(): [number, number, number, number] {
    return [this.x, this.y, this.z, this.w];
  }

  toString(): string {
    return `Quat(${this.x.toFixed(3)}, ${this.y.toFixed(3)}, ${this.z.toFixed(3)}, ${this.w.toFixed(3)})`;
  }
}
