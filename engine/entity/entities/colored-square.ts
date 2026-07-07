/**
 * ColoredSquare — a flat colored plane in 3D space.
 * Replaces the PixiJS Graphics rectangle with a Three.js plane mesh.
 *
 * Note: borderRadius and strokeWidth are not supported in 3D (would require custom shader).
 */
import {
  Entity,
  EntitySpawned,
  EntityDestroyed,
  EntityEnableChanged,
  type EntityContext,
  ColorAdapter,
  type IBounds,
} from "@rebur/engine";
import type { MeshHandle, GeometryDesc, MaterialDesc } from "../../renderer/api.ts";

export class ColoredSquare extends Entity {
  static {
    Entity.registerType(this, "@core");
  }

  static readonly icon = "🟩";

  width: number = 1;
  height: number = 1;
  color: string = "white";
  tint: string = "white";
  /** Not rendered in 3D (kept for data compatibility). */
  borderRadius: number = 0;
  /** Not rendered in 3D (kept for data compatibility). */
  strokeColor: string = "black";
  /** Not rendered in 3D (kept for data compatibility). */
  strokeWidth: number = 0;

  #meshHandle: MeshHandle | undefined;

  #bounds = { width: this.width, height: this.height };
  get bounds(): IBounds {
    return this.#bounds;
  }

  constructor(ctx: EntityContext) {
    super(ctx);

    this.defineValue(ColoredSquare, "width", { description: "Width in local space units." });
    this.defineValue(ColoredSquare, "height", { description: "Height in local space units." });
    this.defineValue(ColoredSquare, "color", {
      type: ColorAdapter,
      description: "Fill color of the square.",
    });
    this.defineValue(ColoredSquare, "tint", {
      type: ColorAdapter,
      description: "Tint multiplier (white = no tint).",
    });
    this.defineValue(ColoredSquare, "borderRadius", {
      description: "Border radius (visual only in 3D — not rendered).",
    });
    this.defineValue(ColoredSquare, "strokeColor", {
      type: ColorAdapter,
      description: "Stroke color (not rendered in 3D).",
    });
    this.defineValue(ColoredSquare, "strokeWidth", {
      description: "Stroke width (not rendered in 3D).",
    });

    this.on(EntitySpawned, () => {
      const game = this.game;
      if (!game.isClient()) return;
      this.#meshHandle = game.renderer.createMesh(
        this.ref,
        this.#buildGeometry(),
        this.#buildMaterial(),
      );
      this.#syncTransform();
    });

    this.on(EntityDestroyed, () => {
      if (!this.game.isClient() || this.#meshHandle === undefined) return;
      this.game.renderer.destroyMesh(this.#meshHandle);
    });

    this.on(EntityEnableChanged, ({ enabled }) => {
      if (!this.game.isClient() || this.#meshHandle === undefined) return;
      this.game.renderer.setMeshVisible(this.#meshHandle, enabled);
    });
  }

  #buildGeometry(): GeometryDesc {
    this.#bounds.width = this.width;
    this.#bounds.height = this.height;
    return { type: "plane", width: this.width, height: this.height };
  }

  #buildMaterial(): MaterialDesc {
    return {
      type: "unlit",
      color: this.color,
      side: "double",
    };
  }

  #syncTransform(): void {
    if (!this.game.isClient() || this.#meshHandle === undefined) return;
    const t = this.globalTransform;
    this.game.renderer.setMeshTransform(this.#meshHandle, t.position, t.rotation, t.scale);
  }

  onFrame(): void {
    if (!this.game.isClient() || this.#meshHandle === undefined) return;
    this.#syncTransform();
    this.game.renderer.updateMeshGeometry(this.#meshHandle, this.#buildGeometry());
    this.game.renderer.updateMeshMaterial(this.#meshHandle, this.#buildMaterial());
  }
}
