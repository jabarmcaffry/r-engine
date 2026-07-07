import type { EntityContext, Transform } from "@rebur/engine";
import {
  Camera,
  Entity,
  EntityDestroyed,
  GameRender,
  Quat,
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

/**
 * Draw a scale handle: line from `base` to `tip` with a filled square at the tip.
 */
function drawScaleHandle(
  ctx2d: CanvasRenderingContext2D,
  base: { x: number; y: number },
  tip: { x: number; y: number },
  color: string,
  lineWidth = 2,
  boxSize = 9,
) {
  ctx2d.beginPath();
  ctx2d.moveTo(base.x, base.y);
  ctx2d.lineTo(tip.x, tip.y);
  ctx2d.strokeStyle = color;
  ctx2d.lineWidth = lineWidth;
  ctx2d.stroke();

  const half = boxSize / 2;
  ctx2d.fillStyle = color;
  ctx2d.fillRect(tip.x - half, tip.y - half, boxSize, boxSize);
  ctx2d.strokeStyle = "rgba(0,0,0,0.4)";
  ctx2d.lineWidth = 0.5;
  ctx2d.strokeRect(tip.x - half, tip.y - half, boxSize, boxSize);
}

/** Sample N screen-space points around a world-space circle. */
function sampleRing(
  worldToScreen: (p: { x: number; y: number; z: number }) => { x: number; y: number } | undefined,
  cx: number,
  cy: number,
  cz: number,
  axis: "x" | "y" | "z",
  radius: number,
  n = 48,
): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const cos = Math.cos(a) * radius;
    const sin = Math.sin(a) * radius;
    const p =
      axis === "x"
        ? { x: cx, y: cy + cos, z: cz + sin }
        : axis === "y"
          ? { x: cx + cos, y: cy, z: cz + sin }
          : { x: cx + cos, y: cy + sin, z: cz };
    const s = worldToScreen(p);
    if (s) pts.push(s);
  }
  return pts;
}

/** Draw a ring (polyline) on a 2-D canvas context. */
function drawRing(
  ctx2d: CanvasRenderingContext2D,
  pts: { x: number; y: number }[],
  color: string,
  lineWidth = 2,
) {
  if (pts.length < 2) return;
  ctx2d.beginPath();
  ctx2d.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx2d.lineTo(pts[i].x, pts[i].y);
  ctx2d.strokeStyle = color;
  ctx2d.lineWidth = lineWidth;
  ctx2d.stroke();
}

/** Minimum distance from a point to any segment of a polyline. */
function minDistToPolyline(mouse: { x: number; y: number }, pts: { x: number; y: number }[]): number {
  let min = Infinity;
  for (const p of pts) min = Math.min(min, dist2d(mouse, p));
  return min;
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
        startMouse: { x: number; y: number };
        originals: Map<Entity, { x: number; y: number; z: number }>;
        originalTransforms: Map<Entity, Transform>;
        center: { x: number; y: number };
        xTip: { x: number; y: number };
        yTip: { x: number; y: number };
        zTip: { x: number; y: number };
      }
    | {
        type: "scale";
        axis: "x" | "y" | "z";
        startMouse: { x: number; y: number };
        originals: Map<Entity, { sx: number; sy: number; sz: number }>;
        originalTransforms: Map<Entity, Transform>;
        center: { x: number; y: number };
        axisTip: { x: number; y: number };
        axisDir: { x: number; y: number };
        axisLen: number;
      }
    | {
        type: "rotate";
        axis: "x" | "y" | "z";
        startAngle: number;
        originals: Map<Entity, { x: number; y: number; z: number; w: number }>;
        originalTransforms: Map<Entity, Transform>;
        center: { x: number; y: number };
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

    const primaryPos = this.#target!.globalTransform.position;
    const center = this.#worldToScreen(primaryPos);
    if (!center) return;

    const xTip = this.#worldToScreen({ x: primaryPos.x + HANDLE_LEN, y: primaryPos.y, z: primaryPos.z });
    const yTip = this.#worldToScreen({ x: primaryPos.x, y: primaryPos.y + HANDLE_LEN, z: primaryPos.z });
    const zTip = this.#worldToScreen({ x: primaryPos.x, y: primaryPos.y, z: primaryPos.z + HANDLE_LEN });
    if (!xTip || !yTip || !zTip) return;

    const mouse = { x: e.offsetX, y: e.offsetY };
    const mode = this.#mode;

    // ---- Rotate mode: hit-test against sampled rings -----------------------
    if (mode === "rotate") {
      const ws2s = (p: { x: number; y: number; z: number }) => this.#worldToScreen(p) ?? { x: 0, y: 0 };
      const xRing = sampleRing(ws2s, primaryPos.x, primaryPos.y, primaryPos.z, "x", HANDLE_LEN);
      const yRing = sampleRing(ws2s, primaryPos.x, primaryPos.y, primaryPos.z, "y", HANDLE_LEN);
      const zRing = sampleRing(ws2s, primaryPos.x, primaryPos.y, primaryPos.z, "z", HANDLE_LEN);

      let axis: "x" | "y" | "z" | undefined;
      let bestDist = HANDLE_HIT_RADIUS;
      const dx2 = minDistToPolyline(mouse, xRing);
      const dy2 = minDistToPolyline(mouse, yRing);
      const dz2 = minDistToPolyline(mouse, zRing);
      if (dx2 < bestDist) { bestDist = dx2; axis = "x"; }
      if (dy2 < bestDist) { bestDist = dy2; axis = "y"; }
      if (dz2 < bestDist) { axis = "z"; }

      if (axis === undefined) { this.#passThroughClick(e); return; }

      const originals = new Map<Entity, { x: number; y: number; z: number; w: number }>();
      const originalTransforms = new Map<Entity, Transform>();
      for (const entity of entities) {
        const r = entity.globalTransform.rotation;
        originals.set(entity, { x: r.x, y: r.y, z: r.z, w: r.w });
        originalTransforms.set(entity, entity.globalTransform.clone());
      }

      this.#action = {
        type: "rotate",
        axis,
        startAngle: Math.atan2(mouse.y - center.y, mouse.x - center.x),
        originals,
        originalTransforms,
        center,
      };
      this.#overlay!.setPointerCapture(e.pointerId);
      const entityList = entities.map(en => ({ entity: en, transform: originalTransforms.get(en)! }));
      this.fire(GizmoUpdateStart, "rotate", entityList);
      this.game.fire(GizmoUpdateStart, "rotate", entityList);
      return;
    }

    // ---- Scale mode: hit-test axis tips ------------------------------------
    if (mode === "scale") {
      let axis: "x" | "y" | "z" | undefined;
      let bestDist = HANDLE_HIT_RADIUS;
      const dx2 = dist2d(mouse, xTip);
      const dy2 = dist2d(mouse, yTip);
      const dz2 = dist2d(mouse, zTip);
      if (dx2 < bestDist) { bestDist = dx2; axis = "x"; }
      if (dy2 < bestDist) { bestDist = dy2; axis = "y"; }
      if (dz2 < bestDist) { axis = "z"; }

      if (axis === undefined) { this.#passThroughClick(e); return; }

      const axisTip = axis === "x" ? xTip : axis === "y" ? yTip : zTip;
      const axisDir = norm2d({ x: axisTip.x - center.x, y: axisTip.y - center.y });
      const axisLen = dist2d(center, axisTip);

      const originals = new Map<Entity, { sx: number; sy: number; sz: number }>();
      const originalTransforms = new Map<Entity, Transform>();
      for (const entity of entities) {
        const s = entity.globalTransform.scale;
        originals.set(entity, { sx: s.x, sy: s.y, sz: s.z });
        originalTransforms.set(entity, entity.globalTransform.clone());
      }

      this.#action = {
        type: "scale",
        axis,
        startMouse: mouse,
        originals,
        originalTransforms,
        center,
        axisTip,
        axisDir,
        axisLen,
      };
      this.#overlay!.setPointerCapture(e.pointerId);
      const entityList = entities.map(en => ({ entity: en, transform: originalTransforms.get(en)! }));
      this.fire(GizmoUpdateStart, "scale", entityList);
      this.game.fire(GizmoUpdateStart, "scale", entityList);
      return;
    }

    // ---- Translate / combined mode: hit-test axis tips + center ------------
    let axis: "x" | "y" | "z" | "free" | undefined;
    let bestDist = HANDLE_HIT_RADIUS;
    const dx2 = dist2d(mouse, xTip);
    const dy2 = dist2d(mouse, yTip);
    const dz2 = dist2d(mouse, zTip);
    const dc2 = dist2d(mouse, center);
    if (dx2 < bestDist) { bestDist = dx2; axis = "x"; }
    if (dy2 < bestDist) { bestDist = dy2; axis = "y"; }
    if (dz2 < bestDist) { bestDist = dz2; axis = "z"; }
    if (dc2 < bestDist) { axis = "free"; }

    if (axis === undefined) { this.#passThroughClick(e); return; }

    const originals = new Map<Entity, { x: number; y: number; z: number }>();
    const originalTransforms = new Map<Entity, Transform>();
    for (const entity of entities) {
      const p = entity.globalTransform.position;
      originals.set(entity, { x: p.x, y: p.y, z: p.z });
      originalTransforms.set(entity, entity.globalTransform.clone());
    }

    this.#action = { type: "translate", axis, startMouse: mouse, originals, originalTransforms, center, xTip, yTip, zTip };
    this.#overlay!.setPointerCapture(e.pointerId);
    const entityList = entities.map(en => ({ entity: en, transform: originalTransforms.get(en)! }));
    this.fire(GizmoUpdateStart, "translate", entityList);
    this.game.fire(GizmoUpdateStart, "translate", entityList);
  };

  /** Pass a pointer event through the overlay to the element underneath. */
  #passThroughClick(e: PointerEvent) {
    this.#overlay!.style.pointerEvents = "none";
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (el) {
      el.dispatchEvent(new PointerEvent("pointerdown", {
        bubbles: true, cancelable: true,
        pointerId: e.pointerId, pointerType: e.pointerType,
        clientX: e.clientX, clientY: e.clientY,
        screenX: e.screenX, screenY: e.screenY,
        button: e.button, buttons: e.buttons,
        ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey, metaKey: e.metaKey,
      }));
    }
    this.#overlay!.style.pointerEvents = "auto";
  }

  #onPointerMove = (e: PointerEvent) => {
    if (!this.#action) return;
    const entities = this.#allTargets();
    if (entities.length === 0) return;

    const mouse = { x: e.offsetX, y: e.offsetY };

    // ---- Rotate -------------------------------------------------------
    if (this.#action.type === "rotate") {
      const currentAngle = Math.atan2(mouse.y - this.#action.center.y, mouse.x - this.#action.center.x);
      const deltaAngle = currentAngle - this.#action.startAngle;
      const rotAxis = this.#action.axis === "x" ? { x: 1, y: 0, z: 0 }
        : this.#action.axis === "y" ? { x: 0, y: 1, z: 0 }
        : { x: 0, y: 0, z: 1 };
      const deltaQ = Quat.fromAxisAngle(rotAxis, deltaAngle);
      for (const entity of entities) {
        const orig = this.#action.originals.get(entity)!;
        const origQ = new Quat(orig.x, orig.y, orig.z, orig.w);
        entity.transform.rotation = deltaQ.multiply(origQ);
      }
      const entityList = entities.map(en => ({ entity: en, transform: en.globalTransform.clone() }));
      this.fire(GizmoUpdateMove, "rotate", entityList);
      this.game.fire(GizmoUpdateMove, "rotate", entityList);
      return;
    }

    // ---- Scale --------------------------------------------------------
    if (this.#action.type === "scale") {
      const dx = mouse.x - this.#action.startMouse.x;
      const dy = mouse.y - this.#action.startMouse.y;
      const proj = dx * this.#action.axisDir.x + dy * this.#action.axisDir.y;
      const factor = Math.max(0.01, 1 + proj / (this.#action.axisLen || 100));
      for (const entity of entities) {
        const orig = this.#action.originals.get(entity)!;
        entity.transform.scale = new Vec3(
          this.#action.axis === "x" ? orig.sx * factor : orig.sx,
          this.#action.axis === "y" ? orig.sy * factor : orig.sy,
          this.#action.axis === "z" ? orig.sz * factor : orig.sz,
        );
      }
      const entityList = entities.map(en => ({ entity: en, transform: en.globalTransform.clone() }));
      this.fire(GizmoUpdateMove, "scale", entityList);
      this.game.fire(GizmoUpdateMove, "scale", entityList);
      return;
    }

    // ---- Translate ----------------------------------------------------
    const dx = mouse.x - this.#action.startMouse.x;
    const dy = mouse.y - this.#action.startMouse.y;
    const { center, xTip, yTip, zTip } = this.#action;

    const xPixelLen = dist2d(center, xTip);
    const yPixelLen = dist2d(center, yTip);
    const zPixelLen = dist2d(center, zTip);
    const xWorldPerPixel = xPixelLen > 1e-6 ? HANDLE_LEN / xPixelLen : 0;
    const yWorldPerPixel = yPixelLen > 1e-6 ? HANDLE_LEN / yPixelLen : 0;
    const zWorldPerPixel = zPixelLen > 1e-6 ? HANDLE_LEN / zPixelLen : 0;

    const xDir = norm2d({ x: xTip.x - center.x, y: xTip.y - center.y });
    const yDir = norm2d({ x: yTip.x - center.x, y: yTip.y - center.y });
    const zDir = norm2d({ x: zTip.x - center.x, y: zTip.y - center.y });
    const dragVec = { x: dx, y: dy };

    let worldDx = 0, worldDy = 0, worldDz = 0;
    if (this.#action.axis === "x") {
      worldDx = (dragVec.x * xDir.x + dragVec.y * xDir.y) * xWorldPerPixel;
    } else if (this.#action.axis === "y") {
      worldDy = (dragVec.x * yDir.x + dragVec.y * yDir.y) * yWorldPerPixel;
    } else if (this.#action.axis === "z") {
      worldDz = (dragVec.x * zDir.x + dragVec.y * zDir.y) * zWorldPerPixel;
    } else {
      const scale = (xWorldPerPixel + zWorldPerPixel) * 0.5 || 0.01;
      worldDx = dx * scale;
      worldDz = dy * scale;
    }

    for (const entity of entities) {
      const orig = this.#action.originals.get(entity)!;
      entity.transform.position = new Vec3(orig.x + worldDx, orig.y + worldDy, orig.z + worldDz);
    }

    const entityList = entities.map(en => ({ entity: en, transform: en.globalTransform.clone() }));
    this.fire(GizmoUpdateMove, "translate", entityList);
    this.game.fire(GizmoUpdateMove, "translate", entityList);
  };

  #onPointerUp = (e: PointerEvent) => {
    if (!this.#action) return;
    const entities = this.#allTargets();
    const op = this.#action.type;

    const entityList = entities.map(entity => ({
      entity,
      transform: entity.globalTransform.clone(),
      previous: this.#action!.originalTransforms.get(entity)!,
    }));

    this.fire(GizmoUpdateEnd, op, entityList);
    this.game.fire(GizmoUpdateEnd, op, entityList);
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

    const primaryPos = this.#target!.globalTransform.position;
    const center = this.#worldToScreen(primaryPos);
    if (!center) return;

    const xTip = this.#worldToScreen({ x: primaryPos.x + HANDLE_LEN, y: primaryPos.y, z: primaryPos.z });
    const yTip = this.#worldToScreen({ x: primaryPos.x, y: primaryPos.y + HANDLE_LEN, z: primaryPos.z });
    const zTip = this.#worldToScreen({ x: primaryPos.x, y: primaryPos.y, z: primaryPos.z + HANDLE_LEN });
    if (!xTip || !yTip || !zTip) return;

    const mode = this.#mode;
    const activeAxis = this.#action ? this.#action.axis : undefined;

    const xColor = activeAxis === "x" ? "#ffaa00" : "#ff4444";
    const yColor = activeAxis === "y" ? "#ffaa00" : "#44ff44";
    const zColor = activeAxis === "z" ? "#ffaa00" : "#4488ff";

    if (mode === "rotate") {
      // --- Rotate mode: draw ring arcs -------------------------------------
      const ws = (p: { x: number; y: number; z: number }) => this.#worldToScreen(p)!;
      const xRing = sampleRing(ws, primaryPos.x, primaryPos.y, primaryPos.z, "x", HANDLE_LEN);
      const yRing = sampleRing(ws, primaryPos.x, primaryPos.y, primaryPos.z, "y", HANDLE_LEN);
      const zRing = sampleRing(ws, primaryPos.x, primaryPos.y, primaryPos.z, "z", HANDLE_LEN);

      drawRing(ctx, xRing, xColor, activeAxis === "x" ? 3 : 2);
      drawRing(ctx, yRing, yColor, activeAxis === "y" ? 3 : 2);
      drawRing(ctx, zRing, zColor, activeAxis === "z" ? 3 : 2);

    } else if (mode === "scale") {
      // --- Scale mode: draw lines with cube tips ---------------------------
      drawScaleHandle(ctx, center, xTip, xColor, 2);
      drawScaleHandle(ctx, center, yTip, yColor, 2);
      drawScaleHandle(ctx, center, zTip, zColor, 2);

    } else {
      // --- Translate / combined: draw arrows -------------------------------
      drawArrow(ctx, center, xTip, xColor, 2, 10);
      drawArrow(ctx, center, yTip, yColor, 2, 10);
      drawArrow(ctx, center, zTip, zColor, 2, 10);

      // Highlight active axis with dashed line
      if (this.#action && this.#action.type === "translate") {
        let tipPt: { x: number; y: number } | undefined;
        if (activeAxis === "x") tipPt = xTip;
        else if (activeAxis === "y") tipPt = yTip;
        else if (activeAxis === "z") tipPt = zTip;
        if (tipPt) {
          ctx.beginPath();
          ctx.moveTo(center.x, center.y);
          ctx.lineTo(tipPt.x, tipPt.y);
          ctx.strokeStyle = "#ffaa00";
          ctx.lineWidth = 4;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }

    // Center dot (always)
    ctx.beginPath();
    ctx.arc(center.x, center.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fill();
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 1.5;
    ctx.stroke();
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
