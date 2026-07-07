import type { EntityContext, Transform } from "@rebur/engine";
import {
  Camera,
  Entity,
  EntityDestroyed,
  GameRender,
} from "@rebur/engine";
import { Vec3 } from "@rebur/engine";

// #region Signals
export class GizmoUpdateStart {
  constructor(
    public readonly operation: "translate" | "rotate" | "scale",
    public readonly entities: {
      readonly entity: Entity;
      readonly transform: Transform;
    }[],
  ) {}
}

export class GizmoUpdateMove {
  constructor(
    public readonly operation: "translate" | "rotate" | "scale",
    public readonly entities: {
      readonly entity: Entity;
      readonly transform: Transform;
    }[],
  ) {}
}

export class GizmoUpdateEnd {
  constructor(
    public readonly operation: "translate" | "rotate" | "scale",
    public readonly entities: {
      readonly entity: Entity;
      readonly transform: Transform;
      readonly previous: Transform;
    }[],
  ) {}
}
// #endregion

// How many world units the axis arms extend
const HANDLE_LEN = 2.0;
// Pixel radius for hit-testing handles
const HANDLE_HIT_RADIUS = 16;

/** Helper: 2-D pixel distance between two screen points */
function dist2d(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Normalize a 2-D screen vector, returns {x:0,y:0} on zero-length */
function norm2d(v: { x: number; y: number }): { x: number; y: number } {
  const l = Math.sqrt(v.x * v.x + v.y * v.y);
  if (l < 1e-6) return { x: 0, y: 0 };
  return { x: v.x / l, y: v.y / l };
}

/**
 * Draw an arrowhead at `tip` pointing away from `base`.
 */
function drawArrow(
  ctx2d: CanvasRenderingContext2D,
  base: { x: number; y: number },
  tip: { x: number; y: number },
  color: string,
  lineWidth = 2,
  arrowSize = 10,
) {
  const dir = norm2d({ x: tip.x - base.x, y: tip.y - base.y });
  const perp = { x: -dir.y, y: dir.x };

  ctx2d.beginPath();
  ctx2d.moveTo(base.x, base.y);
  ctx2d.lineTo(tip.x, tip.y);
  ctx2d.strokeStyle = color;
  ctx2d.lineWidth = lineWidth;
  ctx2d.stroke();

  // Arrowhead triangle
  ctx2d.beginPath();
  ctx2d.moveTo(tip.x, tip.y);
  ctx2d.lineTo(
    tip.x - dir.x * arrowSize + perp.x * (arrowSize * 0.4),
    tip.y - dir.y * arrowSize + perp.y * (arrowSize * 0.4),
  );
  ctx2d.lineTo(
    tip.x - dir.x * arrowSize - perp.x * (arrowSize * 0.4),
    tip.y - dir.y * arrowSize - perp.y * (arrowSize * 0.4),
  );
  ctx2d.closePath();
  ctx2d.fillStyle = color;
  ctx2d.fill();
}

export class Gizmo extends Entity {
  static {
    Entity.registerType(this, "@editor");
  }

  static readonly icon: string = "➡️";
  readonly bounds: undefined;

  // ---- Overlay canvas -------------------------------------------------------
  #overlay: HTMLCanvasElement | undefined;
  #ctx2d: CanvasRenderingContext2D | undefined;
  #resizeObserver: ResizeObserver | undefined;

  // ---- Targets (set externally) ---------------------------------------------
  /** Primary target entity */
  #target: Entity | undefined;
  /** Additional targets (multi-select) */
  #auxTargets: Entity[] = [];

  get target(): Entity | undefined {
    return this.#target;
  }
  set target(value: Entity | undefined) {
    if (this.#target) {
      this.#target.unregister(EntityDestroyed, this.#onTargetDestroyed);
    }
    this.#target = value;
    if (this.#target) {
      this.#target.on(EntityDestroyed, this.#onTargetDestroyed);
    }
  }

  #onTargetDestroyed = () => {
    this.target = undefined;
    this.#auxTargets = [];
  };

  get auxTargets(): Entity[] {
    return [...this.#auxTargets];
  }
  set auxTargets(value: Entity[]) {
    this.#auxTargets = [...value];
  }

  /** All selected entities (primary + aux), sorted shallowest first */
  #allTargets(): Entity[] {
    if (!this.#target) return [];
    return [this.#target, ...this.#auxTargets];
  }

  // ---- Mode (translate | rotate | scale | combined) -------------------------
  /** Which gizmo operations are enabled. Currently only translate is implemented. */
  #mode: "translate" | "rotate" | "scale" | "combined" = "combined";

  get mode(): "translate" | "rotate" | "scale" | "combined" {
    return this.#mode;
  }
  set mode(value: "translate" | "rotate" | "scale" | "combined") {
    this.#mode = value;
  }

  // ---- Drag state -----------------------------------------------------------
  #action:
    | {
        type: "translate";
        axis: "x" | "y" | "z" | "free";
        /** Start mouse position in canvas pixels */
        startMouse: { x: number; y: number };
        /** Per-entity original world positions */
        originals: Map<Entity, { x: number; y: number; z: number }>;
        /** Per-entity original transforms (for signal) */
        originalTransforms: Map<Entity, Transform>;
        /** Projected screen positions at drag start (for axis direction) */
        center: { x: number; y: number };
        xTip: { x: number; y: number };
        yTip: { x: number; y: number };
        zTip: { x: number; y: number };
      }
    | undefined;


  /** worldToScreen via the client renderer; undefined on the server. */
  #worldToScreen(pos: { x: number; y: number; z: number }): { x: number; y: number } | undefined {
    const game = this.game;
    if (!game.isClient()) return undefined;
    return game.renderer.worldToScreen(pos);
  }

  // ---- Pointer handlers (bound to overlay) ----------------------------------
  #onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const entities = this.#allTargets();
    if (entities.length === 0) return;

    // Compute projected positions for the primary entity
    const primaryPos = this.#target!.globalTransform.position;
    const center = this.#worldToScreen(primaryPos);
    if (!center) return;

    const xTip = this.#worldToScreen({
      x: primaryPos.x + HANDLE_LEN,
      y: primaryPos.y,
      z: primaryPos.z,
    });
    const yTip = this.#worldToScreen({
      x: primaryPos.x,
      y: primaryPos.y + HANDLE_LEN,
      z: primaryPos.z,
    });
    const zTip = this.#worldToScreen({
      x: primaryPos.x,
      y: primaryPos.y,
      z: primaryPos.z + HANDLE_LEN,
    });

    if (!xTip || !yTip || !zTip) return;

    const mouse = { x: e.offsetX, y: e.offsetY };

    // Determine which handle was hit
    let axis: "x" | "y" | "z" | "free" | undefined;
    let bestDist = HANDLE_HIT_RADIUS;

    const dx = dist2d(mouse, xTip);
    const dy = dist2d(mouse, yTip);
    const dz = dist2d(mouse, zTip);
    const dc = dist2d(mouse, center);

    if (dx < bestDist) { bestDist = dx; axis = "x"; }
    if (dy < bestDist) { bestDist = dy; axis = "y"; }
    if (dz < bestDist) { bestDist = dz; axis = "z"; }
    if (dc < bestDist) { axis = "free"; }

    if (axis === undefined) {
      // No handle hit — pass event through to the element below the overlay
      this.#overlay!.style.pointerEvents = "none";
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el) {
        el.dispatchEvent(new PointerEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          pointerId: e.pointerId,
          pointerType: e.pointerType,
          clientX: e.clientX,
          clientY: e.clientY,
          screenX: e.screenX,
          screenY: e.screenY,
          button: e.button,
          buttons: e.buttons,
          ctrlKey: e.ctrlKey,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
          metaKey: e.metaKey,
        }));
      }
      this.#overlay!.style.pointerEvents = "auto";
      return;
    }

    // Record originals
    const originals = new Map<Entity, { x: number; y: number; z: number }>();
    const originalTransforms = new Map<Entity, Transform>();
    for (const entity of entities) {
      const p = entity.globalTransform.position;
      originals.set(entity, { x: p.x, y: p.y, z: p.z });
      originalTransforms.set(entity, entity.globalTransform.clone());
    }

    this.#action = {
      type: "translate",
      axis,
      startMouse: mouse,
      originals,
      originalTransforms,
      center,
      xTip,
      yTip,
      zTip,
    };

    this.#overlay!.setPointerCapture(e.pointerId);

    const entityList = entities.map(entity => ({
      entity,
      transform: originalTransforms.get(entity)!,
    }));
    this.fire(GizmoUpdateStart, "translate", entityList);
    this.game.fire(GizmoUpdateStart, "translate", entityList);
  };

  #onPointerMove = (e: PointerEvent) => {
    if (!this.#action) return;
    const entities = this.#allTargets();
    if (entities.length === 0) return;

    const mouse = { x: e.offsetX, y: e.offsetY };
    const dx = mouse.x - this.#action.startMouse.x;
    const dy = mouse.y - this.#action.startMouse.y;

    const { center, xTip, yTip, zTip } = this.#action;

    // Compute pixels-per-world-unit for each axis
    const xPixelLen = dist2d(center, xTip);
    const yPixelLen = dist2d(center, yTip);
    const zPixelLen = dist2d(center, zTip);

    const xWorldPerPixel = xPixelLen > 1e-6 ? HANDLE_LEN / xPixelLen : 0;
    const yWorldPerPixel = yPixelLen > 1e-6 ? HANDLE_LEN / yPixelLen : 0;
    const zWorldPerPixel = zPixelLen > 1e-6 ? HANDLE_LEN / zPixelLen : 0;

    // Screen direction of each axis
    const xDir = norm2d({ x: xTip.x - center.x, y: xTip.y - center.y });
    const yDir = norm2d({ x: yTip.x - center.x, y: yTip.y - center.y });
    const zDir = norm2d({ x: zTip.x - center.x, y: zTip.y - center.y });

    const dragVec = { x: dx, y: dy };

    // Project drag onto screen axis direction, then convert to world units
    let worldDx = 0;
    let worldDy = 0;
    let worldDz = 0;

    if (this.#action.axis === "x") {
      const proj = dragVec.x * xDir.x + dragVec.y * xDir.y;
      worldDx = proj * xWorldPerPixel;
    } else if (this.#action.axis === "y") {
      const proj = dragVec.x * yDir.x + dragVec.y * yDir.y;
      worldDy = proj * yWorldPerPixel;
    } else if (this.#action.axis === "z") {
      const proj = dragVec.x * zDir.x + dragVec.y * zDir.y;
      worldDz = proj * zWorldPerPixel;
    } else {
      // free: X drag moves world X, Y drag moves world Z (Y-up convention)
      // Use the projected magnitudes for scale, but free movement
      const scale = (xWorldPerPixel + zWorldPerPixel) * 0.5 || 0.01;
      worldDx = dx * scale;
      worldDz = dy * scale; // screen Y → world Z
    }

    for (const entity of entities) {
      const orig = this.#action.originals.get(entity)!;
      entity.transform.position = new Vec3(
        orig.x + worldDx,
        orig.y + worldDy,
        orig.z + worldDz,
      );
    }

    const entityList = entities.map(entity => ({
      entity,
      transform: entity.globalTransform.clone(),
    }));
    this.fire(GizmoUpdateMove, "translate", entityList);
    this.game.fire(GizmoUpdateMove, "translate", entityList);
  };

  #onPointerUp = (e: PointerEvent) => {
    if (!this.#action) return;
    const entities = this.#allTargets();

    const entityList = entities.map(entity => ({
      entity,
      transform: entity.globalTransform.clone(),
      previous: this.#action!.originalTransforms.get(entity)!,
    }));

    this.fire(GizmoUpdateEnd, "translate", entityList);
    this.game.fire(GizmoUpdateEnd, "translate", entityList);

    this.#overlay!.releasePointerCapture(e.pointerId);
    this.#action = undefined;
  };

  // ---- Rendering ------------------------------------------------------------
  #drawGizmo() {
    if (!this.#ctx2d || !this.#overlay) return;
    const canvas = this.#overlay;
    const ctx = this.#ctx2d;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const entities = this.#allTargets();
    if (entities.length === 0) return;

    // Use the primary entity's position for the gizmo origin
    const primaryPos = this.#target!.globalTransform.position;

    const center = this.#worldToScreen(primaryPos);
    if (!center) return;

    const xTip = this.#worldToScreen({
      x: primaryPos.x + HANDLE_LEN,
      y: primaryPos.y,
      z: primaryPos.z,
    });
    const yTip = this.#worldToScreen({
      x: primaryPos.x,
      y: primaryPos.y + HANDLE_LEN,
      z: primaryPos.z,
    });
    const zTip = this.#worldToScreen({
      x: primaryPos.x,
      y: primaryPos.y,
      z: primaryPos.z + HANDLE_LEN,
    });

    if (!xTip || !yTip || !zTip) return;

    // Draw X (red), Y (green), Z (blue) axis arrows
    drawArrow(ctx, center, xTip, "#ff4444", 2, 10);
    drawArrow(ctx, center, yTip, "#44ff44", 2, 10);
    drawArrow(ctx, center, zTip, "#4488ff", 2, 10);

    // Draw center circle
    ctx.beginPath();
    ctx.arc(center.x, center.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fill();
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // If dragging, highlight the active axis
    if (this.#action) {
      const axisColors: Record<string, string> = {
        x: "#ffaa00",
        y: "#ffaa00",
        z: "#ffaa00",
        free: "#ffdd00",
      };
      const highlightColor = axisColors[this.#action.axis] ?? "#ffaa00";

      let tipPt: { x: number; y: number } | undefined;
      if (this.#action.axis === "x") tipPt = xTip;
      else if (this.#action.axis === "y") tipPt = yTip;
      else if (this.#action.axis === "z") tipPt = zTip;

      if (tipPt) {
        ctx.beginPath();
        ctx.moveTo(center.x, center.y);
        ctx.lineTo(tipPt.x, tipPt.y);
        ctx.strokeStyle = highlightColor;
        ctx.lineWidth = 4;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  // ---- Lifecycle ------------------------------------------------------------
  constructor(ctx: EntityContext) {
    super(ctx);

    // Must be a local entity
    if (ctx.parent !== this.game.local || !this.game.isClient()) {
      throw new Error(`${this.constructor.name} must be spawned as a local client entity`);
    }

    this.listen(this.game, GameRender, () => {
      this.#drawGizmo();
    });

    this.on(EntityDestroyed, () => {
      if (this.#resizeObserver) {
        this.#resizeObserver.disconnect();
        this.#resizeObserver = undefined;
      }
      if (this.#overlay) {
        this.#overlay.removeEventListener("pointerdown", this.#onPointerDown);
        this.#overlay.removeEventListener("pointermove", this.#onPointerMove);
        this.#overlay.removeEventListener("pointerup", this.#onPointerUp);
        this.#overlay.remove();
        this.#overlay = undefined;
        this.#ctx2d = undefined;
      }
    });
  }

  onInitialize() {
    if (!this.game.isClient()) return;

    const game = this.game;
    if (!game.isClient()) return;
    const rendererCanvas = game.renderer.canvas;
    const parent = rendererCanvas.parentElement ?? document.body;

    // Create overlay canvas
    const overlay = document.createElement("canvas");
    overlay.style.position = "absolute";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.pointerEvents = "auto";
    overlay.style.zIndex = "9999";

    // Match renderer canvas position/size
    const syncSize = () => {
      const rect = rendererCanvas.getBoundingClientRect();
      const parentRect = parent.getBoundingClientRect();
      overlay.width = rect.width;
      overlay.height = rect.height;
      overlay.style.top = `${rect.top - parentRect.top}px`;
      overlay.style.left = `${rect.left - parentRect.left}px`;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;
    };

    // Set parent to position:relative if it isn't already
    const parentStyle = window.getComputedStyle(parent);
    if (parentStyle.position === "static") {
      (parent as HTMLElement).style.position = "relative";
    }

    parent.appendChild(overlay);
    syncSize();

    this.#overlay = overlay;
    this.#ctx2d = overlay.getContext("2d")!;

    // Keep overlay sized to match renderer canvas
    this.#resizeObserver = new ResizeObserver(() => syncSize());
    this.#resizeObserver.observe(rendererCanvas);
    this.#resizeObserver.observe(parent);

    overlay.addEventListener("pointerdown", this.#onPointerDown);
    overlay.addEventListener("pointermove", this.#onPointerMove);
    overlay.addEventListener("pointerup", this.#onPointerUp);
  }
}
