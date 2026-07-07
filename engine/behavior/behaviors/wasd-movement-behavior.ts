/**
 * WASDMovementBehavior — moves the attached entity on the XZ plane with WASD keys.
 * Updated for 3D: uses Vec3 instead of the 2D Vector2.
 */
import { Behavior, Vec3 } from "@rebur/engine";

export default class WASDMovementBehavior extends Behavior {
  speed = 1.0;

  #up = this.inputs.create("@wasd/up", "Move Up", "KeyW");
  #down = this.inputs.create("@wasd/down", "Move Down", "KeyS");
  #left = this.inputs.create("@wasd/left", "Move Left", "KeyA");
  #right = this.inputs.create("@wasd/right", "Move Right", "KeyD");

  onInitialize(): void {
    this.defineValue(WASDMovementBehavior, "speed");
  }

  onTick(): void {
    const movement = new Vec3(0, 0, 0);
    if (this.#up.held) movement.z -= 1;    // forward (-Z in Three.js)
    if (this.#down.held) movement.z += 1;  // backward
    if (this.#right.held) movement.x += 1;
    if (this.#left.held) movement.x -= 1;

    this.entity.transform.position = this.entity.transform.position.add(
      movement.normalized().scale((this.time.delta / 100) * this.speed),
    );
  }
}
