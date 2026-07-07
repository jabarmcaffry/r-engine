export interface IVec3 {
  x: number;
  y: number;
  z: number;
}

export class Vec3 implements IVec3 {
  x: number;
  y: number;
  z: number;

  static readonly ZERO = Object.freeze(new Vec3(0, 0, 0));
  static readonly ONE = Object.freeze(new Vec3(1, 1, 1));
  static readonly UP = Object.freeze(new Vec3(0, 1, 0));
  static readonly DOWN = Object.freeze(new Vec3(0, -1, 0));
  static readonly FORWARD = Object.freeze(new Vec3(0, 0, -1));
  static readonly BACK = Object.freeze(new Vec3(0, 0, 1));
  static readonly RIGHT = Object.freeze(new Vec3(1, 0, 0));
  static readonly LEFT = Object.freeze(new Vec3(-1, 0, 0));

  constructor(x?: number, y?: number, z?: number);
  constructor(v: IVec3);
  constructor(xOrV: number | IVec3 = 0, y = 0, z = 0) {
    if (typeof xOrV === "object") {
      this.x = xOrV.x;
      this.y = xOrV.y;
      this.z = xOrV.z;
    } else {
      this.x = xOrV;
      this.y = y;
      this.z = z;
    }
  }

  add(other: IVec3): Vec3 {
    return new Vec3(this.x + other.x, this.y + other.y, this.z + other.z);
  }

  addScalar(s: number): Vec3 {
    return new Vec3(this.x + s, this.y + s, this.z + s);
  }

  sub(other: IVec3): Vec3 {
    return new Vec3(this.x - other.x, this.y - other.y, this.z - other.z);
  }

  mul(other: IVec3): Vec3 {
    return new Vec3(this.x * other.x, this.y * other.y, this.z * other.z);
  }

  scale(s: number): Vec3 {
    return new Vec3(this.x * s, this.y * s, this.z * s);
  }

  dot(other: IVec3): number {
    return this.x * other.x + this.y * other.y + this.z * other.z;
  }

  cross(other: IVec3): Vec3 {
    return new Vec3(
      this.y * other.z - this.z * other.y,
      this.z * other.x - this.x * other.z,
      this.x * other.y - this.y * other.x,
    );
  }

  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  lengthSq(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  normalized(): Vec3 {
    const l = this.length();
    if (l === 0) return new Vec3(0, 0, 0);
    return new Vec3(this.x / l, this.y / l, this.z / l);
  }

  distanceTo(other: IVec3): number {
    return this.sub(other).length();
  }

  lerp(other: IVec3, t: number): Vec3 {
    return new Vec3(
      this.x + (other.x - this.x) * t,
      this.y + (other.y - this.y) * t,
      this.z + (other.z - this.z) * t,
    );
  }

  negate(): Vec3 {
    return new Vec3(-this.x, -this.y, -this.z);
  }

  abs(): Vec3 {
    return new Vec3(Math.abs(this.x), Math.abs(this.y), Math.abs(this.z));
  }

  clone(): Vec3 {
    return new Vec3(this.x, this.y, this.z);
  }

  assign(other: IVec3): this {
    this.x = other.x;
    this.y = other.y;
    this.z = other.z;
    return this;
  }

  set(x: number, y: number, z: number): this {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  equals(other: IVec3, epsilon = 1e-6): boolean {
    return (
      Math.abs(this.x - other.x) < epsilon &&
      Math.abs(this.y - other.y) < epsilon &&
      Math.abs(this.z - other.z) < epsilon
    );
  }

  /** Returns a plain `{x,y,z}` object (no prototype chain). Useful for serialisation. */
  bare(): IVec3 {
    return { x: this.x, y: this.y, z: this.z };
  }

  toArray(): [number, number, number] {
    return [this.x, this.y, this.z];
  }

  toString(): string {
    return `Vec3(${this.x.toFixed(3)}, ${this.y.toFixed(3)}, ${this.z.toFixed(3)})`;
  }
}
