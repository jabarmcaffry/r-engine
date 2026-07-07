/**
 * SpinBehavior — rotates the entity around the Y axis at a given speed.
 * Updated for 3D: uses Quat.fromAxisAngle instead of a 2D rotation number.
 */
import { Behavior, Quat } from "@rebur/engine";

export default class SpinBehavior extends Behavior {
  speed: number = 1.0;
  /** Rotation axis: "x", "y", or "z". Default is "y" (vertical). */
  axis: string = "y";

  onInitialize(): void {
    this.defineValue(SpinBehavior, "speed");
    this.defineValue(SpinBehavior, "axis");
  }

  onTick(): void {
    const angle = this.speed * (Math.PI / this.game.time.TPS);
    const ax = this.axis === "x" ? 1 : 0;
    const ay = this.axis === "y" ? 1 : 0;
    const az = this.axis === "z" ? 1 : 0;
    const delta = Quat.fromAxisAngle({ x: ax, y: ay, z: az }, angle);
    this.entity.transform.rotation = this.entity.transform.rotation.multiply(delta);
  }
}
