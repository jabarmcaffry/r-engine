/**
 * DefaultCharacter — the engine's built-in playable character.
 *
 * Drop one into a scene and press Play: WASD to move (camera-relative),
 * mouse to look (click the canvas to grab the pointer), Space to jump,
 * Shift to sprint. Works first-person (cameraDistance = 0) or third-person.
 *
 * The character auto-assembles a capsule body mesh and a camera rig as
 * child entities the first time it spawns, so scenes stay tiny. In
 * multiplayer, input is only processed by the client that has authority
 * over the entity — spawn one per player (see PlayerSpawnerBehavior) and
 * give each player authority over theirs.
 */
import {
  Camera,
  EntityDestroyed,
  EntitySpawned,
  GameRender,
  GameTick,
  Mesh,
  MouseDown,
  MouseMove,
  Vec3,
  Quat,
  type EntityContext,
} from "@rebur/engine";
import { CharacterController } from "./character-controller.ts";
import { Entity } from "../entity.ts";

export class DefaultCharacter extends CharacterController {
  static {
    Entity.registerType(this, "@core");
  }

  static override readonly icon: string = "🧍";

  /** Walk speed in units/second. */
  moveSpeed: number = 6;
  /** Multiplier applied while Shift is held. */
  sprintMultiplier: number = 1.6;
  /** Jump height in world units. */
  jumpHeight: number = 1.2;
  /** Downward acceleration (units/s²). */
  gravity: number = 24;
  /** Camera boom length. 0 = first person. */
  cameraDistance: number = 5;
  /** Eye height for the camera pivot. */
  cameraHeight: number = 1.6;
  /** Radians of look rotation per pixel of mouse movement. */
  mouseSensitivity: number = 0.0025;
  /** When false the character spawns no camera (e.g. NPCs / other players). */
  possessCamera: boolean = true;
  /** Body capsule color. */
  bodyColor: number = 0x4f8dff;

  #yaw = 0;
  #pitch = -0.2;
  #verticalVelocity = 0;
  #pointerLocked = false;

  constructor(ctx: EntityContext) {
    super(ctx);

    this.defineValue(DefaultCharacter, "moveSpeed", { description: "Walk speed (units/s)." });
    this.defineValue(DefaultCharacter, "sprintMultiplier", {
      description: "Speed multiplier while sprinting (Shift).",
    });
    this.defineValue(DefaultCharacter, "jumpHeight", { description: "Jump height (units)." });
    this.defineValue(DefaultCharacter, "gravity", { description: "Gravity (units/s²)." });
    this.defineValue(DefaultCharacter, "cameraDistance", {
      description: "Third-person camera distance. 0 = first person.",
    });
    this.defineValue(DefaultCharacter, "cameraHeight", { description: "Camera eye height." });
    this.defineValue(DefaultCharacter, "mouseSensitivity", {
      description: "Look sensitivity (radians per pixel).",
    });
    this.defineValue(DefaultCharacter, "possessCamera", {
      description: "Spawn and control a camera for this character.",
    });
    this.defineValue(DefaultCharacter, "bodyColor", { description: "Capsule body color." });

    this.on(EntitySpawned, () => {
      this.#assembleBody();
      if (this.game.isClient() && this.#hasLocalControl()) {
        this.#assembleCamera();
        this.#bindInputs();
      }
    });

    this.listen(this.game, GameTick, () => this.#onTick());
    this.listen(this.game, GameRender, () => this.#onFrame());

    this.on(EntityDestroyed, () => {
      if (this.#pointerLocked && this.game.isClient()) {
        document.exitPointerLock?.();
      }
    });
  }

  /** Whether this client should process input for the character. */
  #hasLocalControl(): boolean {
    if (!this.game.isClient()) return false;
    const self = this.game.network.self;
    return this.authority === undefined || this.authority === self;
  }

  #assembleBody(): void {
    if (this.children.has("Body")) return;
    this.spawn({
      type: Mesh,
      name: "Body",
      transform: { position: { x: 0, y: 0, z: 0 } },
      values: {
        geometryType: "capsule",
        sphereRadius: this.radius,
        boxHeight: this.height - this.radius * 2,
        color: this.bodyColor,
        roughness: 0.6,
      },
    });
  }

  #camera(): Camera | undefined {
    return this.children.get("Camera")?.cast(Camera);
  }

  #assembleCamera(): void {
    if (!this.possessCamera) return;
    if (this.children.has("Camera")) return;
    this.spawn({
      type: Camera,
      name: "Camera",
      transform: { position: { x: 0, y: this.cameraHeight, z: this.cameraDistance } },
      values: { active: true },
    });
  }

  #bindInputs(): void {
    const inputs = this.game.inputs;
    inputs.create("@character/forward", "Move Forward", "KeyW");
    inputs.create("@character/back", "Move Back", "KeyS");
    inputs.create("@character/left", "Move Left", "KeyA");
    inputs.create("@character/right", "Move Right", "KeyD");
    inputs.create("@character/jump", "Jump", "Space");
    inputs.create("@character/sprint", "Sprint", "ShiftLeft");

    // Pointer-lock look: click the canvas to grab the mouse (play mode only —
    // the editor never gives the character local control in edit sessions).
    this.listen(inputs, MouseDown, () => {
      if (!this.#hasLocalControl()) return;
      const canvas = this.game.isClient() ? this.game.renderer.canvas : undefined;
      if (canvas && document.pointerLockElement !== canvas) {
        canvas.requestPointerLock?.();
      }
    });

    this.listen(inputs, MouseMove, ({ ev }) => {
      if (!this.#hasLocalControl()) return;
      const canvas = this.game.isClient() ? this.game.renderer.canvas : undefined;
      this.#pointerLocked = !!canvas && document.pointerLockElement === canvas;
      if (!this.#pointerLocked) return;

      this.#yaw -= ev.movementX * this.mouseSensitivity;
      this.#pitch -= ev.movementY * this.mouseSensitivity;
      const limit = Math.PI / 2 - 0.05;
      this.#pitch = Math.max(-limit, Math.min(limit, this.#pitch));
    });
  }

  #onTick(): void {
    if (!this.#hasLocalControl()) return;
    const inputs = this.game.inputs;
    const dt = this.game.time.delta / 1000;
    if (dt <= 0) return;

    // --- horizontal movement, relative to look yaw -------------------------
    let ix = 0;
    let iz = 0;
    if (inputs.get("@character/forward")?.held) iz -= 1;
    if (inputs.get("@character/back")?.held) iz += 1;
    if (inputs.get("@character/left")?.held) ix -= 1;
    if (inputs.get("@character/right")?.held) ix += 1;

    const sprint = inputs.get("@character/sprint")?.held ? this.sprintMultiplier : 1;
    const speed = this.moveSpeed * sprint;

    const sin = Math.sin(this.#yaw);
    const cos = Math.cos(this.#yaw);
    const len = Math.hypot(ix, iz) || 1;
    const vx = ((ix * cos - iz * sin) / len) * speed;
    const vz = ((ix * sin + iz * cos) / len) * speed;

    // --- gravity & jumping --------------------------------------------------
    const grounded = this.isGrounded;
    if (grounded && this.#verticalVelocity <= 0) {
      this.#verticalVelocity = -0.5; // small downward bias keeps us snapped
      if (inputs.get("@character/jump")?.held) {
        this.#verticalVelocity = Math.sqrt(2 * this.gravity * this.jumpHeight);
      }
    } else {
      this.#verticalVelocity -= this.gravity * dt;
    }

    this.move(new Vec3(vx, this.#verticalVelocity, vz), dt);

    // --- face movement direction / look direction ---------------------------
    this.transform.rotation = Quat.fromAxisAngle({ x: 0, y: 1, z: 0 }, this.#yaw);
  }

  #onFrame(): void {
    if (!this.#hasLocalControl()) return;
    const camera = this.#camera();
    if (!camera) return;

    // Camera rig: pitch around the eye pivot, boom backwards by cameraDistance.
    const pitchQuat = Quat.fromAxisAngle({ x: 1, y: 0, z: 0 }, this.#pitch);
    const boom = pitchQuat.rotateVec3({ x: 0, y: 0, z: this.cameraDistance });

    camera.transform.position = new Vec3(boom.x, this.cameraHeight + boom.y, boom.z);
    camera.transform.rotation = pitchQuat;
  }
}
