import { Behavior, Camera, CharacterController, Mesh, Vec3, Quat } from "@rebur/engine";

/**
 * First-person shooter controller.
 *
 * Attach this behavior to a CharacterController entity that has a child
 * Camera entity named "FPSCamera". Click the viewport to lock the pointer,
 * then use WASD to move, mouse to look, Space to jump, LMB to shoot.
 */
export default class FPSController extends Behavior {
  speed: number = 6;
  jumpForce: number = 7;
  sensitivity: number = 0.0025;

  #cc: CharacterController | undefined;
  #camera: Camera | undefined;
  #yaw: number = 0;
  #pitch: number = 0;
  #isLocked: boolean = false;
  #velocityY: number = 0;
  #mouseMoveHandler: ((ev: MouseEvent) => void) | undefined;
  #bullets: { mesh: Mesh; vx: number; vy: number; vz: number; life: number }[] = [];
  #crosshair: HTMLElement | undefined;
  #hud: HTMLElement | undefined;

  onInitialize(): void {
    if (!this.game.isClient()) return;

    this.#cc = this.entity.cast(CharacterController);
    if (!this.#cc) {
      console.error("FPSController must be attached to a CharacterController entity");
      return;
    }

    this.#camera = this.entity.children.get("FPSCamera")?.cast(Camera);
    if (this.#camera) {
      this.#camera.active = true;
    }

    const canvas = this.game.renderer.canvas;
    const container = (canvas.parentElement ?? document.body) as HTMLElement;

    // ---- Crosshair --------------------------------------------------------
    const crosshair = document.createElement("div");
    crosshair.style.cssText =
      "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);" +
      "width:22px;height:22px;pointer-events:none;z-index:200;";
    crosshair.innerHTML =
      '<svg viewBox="0 0 22 22" width="22" height="22">' +
      '<line x1="11" y1="1" x2="11" y2="8" stroke="white" stroke-width="1.5" stroke-linecap="round" opacity="0.85"/>' +
      '<line x1="11" y1="14" x2="11" y2="21" stroke="white" stroke-width="1.5" stroke-linecap="round" opacity="0.85"/>' +
      '<line x1="1" y1="11" x2="8" y2="11" stroke="white" stroke-width="1.5" stroke-linecap="round" opacity="0.85"/>' +
      '<line x1="14" y1="11" x2="21" y2="11" stroke="white" stroke-width="1.5" stroke-linecap="round" opacity="0.85"/>' +
      "</svg>";
    container.appendChild(crosshair);
    this.#crosshair = crosshair;

    // ---- HUD instructions -------------------------------------------------
    const hud = document.createElement("div");
    hud.style.cssText =
      "position:absolute;bottom:28px;left:50%;transform:translateX(-50%);" +
      "color:white;font:bold 13px/1.4 monospace;text-shadow:0 1px 5px rgba(0,0,0,0.9);" +
      "pointer-events:none;z-index:200;white-space:nowrap;background:rgba(0,0,0,0.35);" +
      "padding:6px 14px;border-radius:6px;transition:opacity 0.5s;";
    hud.textContent = "Click to play  ·  WASD Move  ·  Space Jump  ·  LMB Shoot  ·  ESC Pause";
    container.appendChild(hud);
    this.#hud = hud;

    // ---- Pointer lock -----------------------------------------------------
    canvas.addEventListener("click", () => {
      if (!this.#isLocked) canvas.requestPointerLock();
    });

    document.addEventListener("pointerlockchange", () => {
      this.#isLocked = document.pointerLockElement === canvas;
      if (hud) hud.style.opacity = this.#isLocked ? "0" : "1";
    });

    this.#mouseMoveHandler = (ev: MouseEvent) => {
      if (!this.#isLocked) return;
      this.#yaw -= ev.movementX * this.sensitivity;
      this.#pitch = Math.max(
        -Math.PI * 0.44,
        Math.min(Math.PI * 0.44, this.#pitch - ev.movementY * this.sensitivity),
      );
    };
    document.addEventListener("pointermove", this.#mouseMoveHandler);

    // Shoot on left mouse button
    canvas.addEventListener("mousedown", (ev: MouseEvent) => {
      if (ev.button === 0 && this.#isLocked) this.#shoot();
    });
  }

  onTick(): void {
    if (!this.game.isClient()) return;
    const cc = this.#cc;
    if (!cc) return;

    const dt = this.time.delta;
    const inputs = this.inputs;

    // ---- Movement ---------------------------------------------------------
    let dx = 0, dz = 0;
    if (inputs.getKey("KeyW") || inputs.getKey("ArrowUp")) dz -= 1;
    if (inputs.getKey("KeyS") || inputs.getKey("ArrowDown")) dz += 1;
    if (inputs.getKey("KeyA") || inputs.getKey("ArrowLeft")) dx -= 1;
    if (inputs.getKey("KeyD") || inputs.getKey("ArrowRight")) dx += 1;

    const yawQ = Quat.fromAxisAngle({ x: 0, y: 1, z: 0 }, this.#yaw);
    const len = Math.sqrt(dx * dx + dz * dz);
    const worldDir =
      len > 0 ? yawQ.rotateVec3({ x: dx / len, y: 0, z: dz / len }) : { x: 0, y: 0, z: 0 };

    // ---- Gravity & jump ---------------------------------------------------
    if (cc.isGrounded) {
      this.#velocityY = inputs.getKey("Space") ? this.jumpForce : 0;
    } else {
      this.#velocityY = Math.max(this.#velocityY - 22 * dt, -30);
    }

    cc.move(
      new Vec3(worldDir.x * this.speed, this.#velocityY, worldDir.z * this.speed),
      dt,
    );

    // ---- Apply look rotations --------------------------------------------
    this.entity.transform.rotation = yawQ;
    if (this.#camera) {
      this.#camera.transform.rotation = Quat.fromAxisAngle({ x: 1, y: 0, z: 0 }, this.#pitch);
    }

    // ---- Advance bullets -------------------------------------------------
    this.#bullets = this.#bullets.filter(b => {
      b.life += dt;
      if (b.life > 4) {
        try { b.mesh.destroy(); } catch { /* already destroyed */ }
        return false;
      }
      const p = b.mesh.transform.position;
      b.mesh.transform.position = new Vec3(
        p.x + b.vx * dt,
        p.y + b.vy * dt,
        p.z + b.vz * dt,
      );
      return true;
    });
  }

  onDestroy(): void {
    this.#crosshair?.remove();
    this.#hud?.remove();
    if (this.#mouseMoveHandler) {
      document.removeEventListener("pointermove", this.#mouseMoveHandler);
      this.#mouseMoveHandler = undefined;
    }
    try { document.exitPointerLock(); } catch { /* ignore */ }
  }

  #shoot(): void {
    if (!this.game.isClient()) return;
    const cam = this.#camera;
    if (!cam) return;

    const pitchQ = Quat.fromAxisAngle({ x: 1, y: 0, z: 0 }, this.#pitch);
    const yawQ = Quat.fromAxisAngle({ x: 0, y: 1, z: 0 }, this.#yaw);
    const rot = yawQ.multiply(pitchQ);
    const fwd = rot.rotateVec3({ x: 0, y: 0, z: -1 });

    const camPos = cam.globalTransform.position;
    const spawnPos = new Vec3(
      camPos.x + fwd.x * 1.5,
      camPos.y + fwd.y * 1.5,
      camPos.z + fwd.z * 1.5,
    );

    const bullet = this.game.world.spawn({ type: Mesh, name: "Bullet" }) as Mesh;
    bullet.transform.position = spawnPos;
    bullet.geometryType = "sphere";
    bullet.sphereRadius = 0.1;
    bullet.color = 0xffee11;
    bullet.roughness = 0.1;
    bullet.metalness = 0.9;
    bullet.castShadow = false;

    const SPEED = 32;
    this.#bullets.push({
      mesh: bullet,
      vx: fwd.x * SPEED,
      vy: fwd.y * SPEED,
      vz: fwd.z * SPEED,
      life: 0,
    });
  }
}
