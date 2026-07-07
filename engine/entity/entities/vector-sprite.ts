/**
 * VectorSprite — a flat plane textured with an SVG image.
 * In 3D the SVG is loaded as a data-URL texture on a plane mesh.
 * Replaces the PixiJS SVG/Graphics approach.
 */
import {
  Entity,
  EntitySpawned,
  EntityDestroyed,
  EntityEnableChanged,
  type EntityContext,
  TextureAdapter,
  type IBounds,
  Bounds,
} from "@rebur/engine";
import type { MeshHandle, GeometryDesc, MaterialDesc } from "../../renderer/api.ts";

export class VectorSprite extends Entity {
  static {
    Entity.registerType(this, "@core");
  }

  static readonly icon = "🖼️";

  width: number = 1;
  height: number = 1;
  texture: string = "";
  alpha: number = 1;

  #meshHandle: MeshHandle | undefined;

  get bounds(): IBounds | undefined {
    return new Bounds(this.width, this.height);
  }

  constructor(ctx: EntityContext) {
    super(ctx);

    this.defineValue(VectorSprite, "width", { description: "Width in world units." });
    this.defineValue(VectorSprite, "height", { description: "Height in world units." });
    this.defineValue(VectorSprite, "alpha", { description: "Opacity 0–1." });
    this.defineValue(VectorSprite, "texture", {
      type: TextureAdapter,
      description: "SVG or image path (res://).",
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
    return { type: "plane", width: this.width, height: this.height };
  }

  #buildMaterial(): MaterialDesc {
    const resolvedTexture = this.texture
      ? this.game.resolveResource(this.texture)
      : undefined;
    return {
      type: "unlit",
      texture: resolvedTexture,
      opacity: this.alpha,
      transparent: true,
      alphaTest: 0.01,
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
