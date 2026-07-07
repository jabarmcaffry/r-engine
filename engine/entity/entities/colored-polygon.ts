/**
 * ColoredPolygon — a regular N-sided polygon mesh in 3D space.
 * Replaces the PixiJS Graphics polygon with a Three.js CircleGeometry (N segments).
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

export class ColoredPolygon extends Entity {
  static {
    Entity.registerType(this, "@core");
  }

  static readonly icon = "🟢";

  sides: number = 4;
  width: number = 1;
  height: number = 1;
  color: string = "white";
  tint: string = "white";
  /** Not rendered in 3D. */
  borderRadius: number = 0;
  /** Not rendered in 3D. */
  strokeColor: string = "black";
  /** Not rendered in 3D. */
  strokeWidth: number = 0;

  #meshHandle: MeshHandle | undefined;

  #bounds = { width: this.width, height: this.height };
  get bounds(): IBounds {
    return this.#bounds;
  }

  constructor(ctx: EntityContext) {
    super(ctx);

    this.defineValue(ColoredPolygon, "width", { description: "Width in local space units." });
    this.defineValue(ColoredPolygon, "height", { description: "Height in local space units." });
    this.defineValue(ColoredPolygon, "sides", { description: "Number of sides (minimum 3)." });
    this.defineValue(ColoredPolygon, "color", {
      type: ColorAdapter,
      description: "Base fill color.",
    });
    this.defineValue(ColoredPolygon, "tint", {
      type: ColorAdapter,
      description: "Tint multiplier.",
    });
    this.defineValue(ColoredPolygon, "borderRadius", {
      description: "Border radius (not rendered in 3D).",
    });
    this.defineValue(ColoredPolygon, "strokeColor", {
      type: ColorAdapter,
      description: "Stroke color (not rendered in 3D).",
    });
    this.defineValue(ColoredPolygon, "strokeWidth", {
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
    return {
      type: "polygon",
      sides: Math.max(3, Math.round(this.sides)),
      width: this.width,
      height: this.height,
    };
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
