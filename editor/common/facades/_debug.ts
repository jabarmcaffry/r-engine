/**
 * 3D debug shapes for the editor.
 *
 * Replaces the old PixiJS 2D overlay system with Three.js wireframe meshes
 * created via game.renderer (IRendererBackend). Each shape creates a thin
 * wireframe mesh in the scene that outlines the entity's bounds.
 */
import {
  Entity,
  EntityDestroyed,
  EntityEnableChanged,
  EntityTransformUpdate,
  IBounds,
  SignalSubscription,
} from "@rebur/engine";
import type { GeometryDesc, MeshHandle } from "@rebur/engine";

// Unique suffix so multiple debug shapes on the same entity don't collide.
let _seq = 0;

export interface DebugShapeOptions {
  readonly entity: Entity;
  readonly enabled?: boolean;
  /** Hex number or CSS color string. Default: "white". */
  readonly color?: number | string;
  readonly alpha?: number;
  readonly suffix?: string;
  /** When true the entity scale is not applied (used for camera viewport box). */
  readonly disableScale?: boolean;
  readonly getBounds?: () => IBounds | undefined;
  // Legacy compat options kept so callers don't need changes — no-op in 3D:
  readonly width?: number;
  readonly pixelLine?: boolean;
  readonly alwaysOnTop?: boolean;
  readonly alignment?: number;
}

export abstract class DebugShape {
  protected readonly entity: Entity;
  #handle: MeshHandle | undefined;
  #enabled: boolean;
  #color: number | string;
  #alpha: number;
  readonly disableScale: boolean;
  protected readonly getBounds: () => IBounds | undefined;

  // Legacy compat fields — kept so callers compile without changes.
  suffix: string;
  alwaysOnTop: boolean = false;
  width: number = 0.04;
  pixelLine: boolean = false;

  get color(): number | string { return this.#color; }
  set color(v: number | string) { this.#color = v; this.#applyMaterial(); }
  get alpha(): number { return this.#alpha; }
  set alpha(v: number) { this.#alpha = v; this.#applyMaterial(); }
  get enabled(): boolean { return this.#enabled; }
  set enabled(v: boolean) {
    if (this.#enabled !== v) {
      this.#enabled = v;
      this.#applyVisible();
    }
  }

  #onTransform: SignalSubscription<EntityTransformUpdate> | undefined;
  #onEnable: SignalSubscription<EntityEnableChanged> | undefined;

  constructor({
    entity,
    enabled = true,
    color = "white",
    alpha = 0.8,
    suffix = "",
    disableScale = false,
    getBounds = () => entity.bounds,
  }: DebugShapeOptions) {
    this.entity = entity;
    this.#enabled = enabled;
    this.#color = color;
    this.#alpha = alpha;
    this.suffix = suffix;
    this.disableScale = disableScale;
    this.getBounds = getBounds;

    if (entity.game.isClient()) {
      this.#createMesh();

      this.#onTransform = entity.on(EntityTransformUpdate, () => {
        this.#applyTransform();
        this.#rebuildGeometry();
      });

      this.#onEnable = entity.on(EntityEnableChanged, () => {
        this.#applyVisible();
      });

      entity.on(EntityDestroyed, () => this.destroy());
    }
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  #createMesh(): void {
    const bounds = this.getBounds();
    if (!bounds) return;
    const ref = `__dbg_${_seq++}_${this.entity.ref}`;
    this.#handle = this.entity.game.renderer.createMesh(ref, this.buildGeometry(bounds), {
      color: this.#color,
      transparent: true,
      opacity: this.#alpha,
      wireframe: true,
      side: "double",
    });
    this.#applyTransform();
    this.#applyVisible();
  }

  #applyTransform(): void {
    if (this.#handle === undefined) return;
    const t = this.entity.globalTransform;
    const scale = this.disableScale ? { x: 1, y: 1, z: 1 } : t.scale;
    this.entity.game.renderer.setMeshTransform(this.#handle, t.position, t.rotation, scale);
  }

  #applyVisible(): void {
    if (this.#handle === undefined) return;
    this.entity.game.renderer.setMeshVisible(
      this.#handle,
      this.#enabled && this.entity.enabled,
    );
  }

  #applyMaterial(): void {
    if (this.#handle === undefined) return;
    this.entity.game.renderer.updateMeshMaterial(this.#handle, {
      color: this.#color,
      opacity: this.#alpha,
    });
  }

  #rebuildGeometry(): void {
    if (this.#handle === undefined) return;
    const bounds = this.getBounds();
    if (!bounds) return;
    this.entity.game.renderer.updateMeshGeometry(this.#handle, this.buildGeometry(bounds));
  }

  // ---------------------------------------------------------------------------
  // Public API (called by facades after value changes)
  // ---------------------------------------------------------------------------

  /** Force a full visual refresh. Also retries mesh creation if bounds were
   *  unavailable at construction time (e.g. ComplexCollider before children). */
  redraw(): void {
    if (this.#handle === undefined) {
      this.#createMesh(); // retry now that bounds may be available
    } else {
      this.#rebuildGeometry();
      this.#applyTransform();
    }
  }

  destroy(): void {
    if (this.#handle !== undefined) {
      this.entity.game.renderer.destroyMesh(this.#handle);
      this.#handle = undefined;
    }
    this.#onTransform?.unsubscribe();
    this.#onEnable?.unsubscribe();
    this.#onTransform = undefined;
    this.#onEnable = undefined;
  }

  // ---------------------------------------------------------------------------
  // Abstract — subclasses define geometry
  // ---------------------------------------------------------------------------
  abstract buildGeometry(bounds: IBounds): GeometryDesc;
}

// ---------------------------------------------------------------------------
// Concrete shapes
// ---------------------------------------------------------------------------

export class DebugSquare extends DebugShape {
  constructor(opts: DebugShapeOptions & { readonly diagonals?: boolean }) {
    super(opts);
  }
  buildGeometry(bounds: IBounds): GeometryDesc {
    // Thin box so the wireframe looks like a rectangle outline in the 3D viewport.
    return { type: "box", width: bounds.width, height: bounds.height, depth: 0.02 };
  }
}

export class DebugCircle extends DebugShape {
  buildGeometry(bounds: IBounds): GeometryDesc {
    return { type: "sphere", radius: bounds.width / 2, segments: 24 };
  }
}

export class DebugCapsule extends DebugShape {
  buildGeometry(bounds: IBounds): GeometryDesc {
    const radius = bounds.width / 2;
    const height = Math.max(0, bounds.height - bounds.width);
    return { type: "capsule", radius, height, segments: 16 };
  }
}

export class DebugPolygon extends DebugShape {
  constructor(
    opts: DebugShapeOptions & {
      readonly getPoints: () => readonly (readonly [number, number])[];
    },
  ) {
    super(opts);
  }
  buildGeometry(bounds: IBounds): GeometryDesc {
    // Complex polygon approximated as a thin wireframe box in 3D.
    // The exact vertex positions are defined by child entities (Empty facades).
    return { type: "box", width: bounds.width || 1, height: bounds.height || 1, depth: 0.02 };
  }
}

// ---------------------------------------------------------------------------
// Label — kept for API compatibility, no visual in 3D.
// ---------------------------------------------------------------------------
export type Label = {
  readonly container: undefined;
  readonly text: { text: string } | undefined;
};
export const createLabel = (_icon: string, _text?: string): Label =>
  Object.freeze({
    container: undefined,
    text: _text !== undefined ? { text: _text } : undefined,
  });
