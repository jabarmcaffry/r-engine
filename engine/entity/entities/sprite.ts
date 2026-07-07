/**
 * Sprite — a textured flat plane in 3D space.
 * Replaces the PixiJS 2D Sprite with a Three.js plane mesh.
 */
import {
  Entity,
  EntitySpawned,
  EntityDestroyed,
  EntityEnableChanged,
  type EntityContext,
  TextureAdapter,
  ColorAdapter,
  type IBounds,
  Bounds,
  SpriteTextureChanged,
} from "@rebur/engine";
import type { MeshHandle, GeometryDesc, MaterialDesc } from "../../renderer/api.ts";

export class Sprite extends Entity {
  static {
    Entity.registerType(this, "@core");
  }

  static readonly icon = "🖼️";

  width: number = 1;
  height: number = 1;
  texture: string = "";
  alpha: number = 1;
  tint: string = "white";
  preserveAspectRatio: boolean = false;

  #meshHandle: MeshHandle | undefined;

  get bounds(): IBounds | undefined {
    return new Bounds(this.width, this.height);
  }

  constructor(ctx: EntityContext) {
    super(ctx);

    this.defineValue(Sprite, "texture", {
      type: TextureAdapter,
      sortOrder: 10,
      description: "Path to the image texture. Drag from project panel or type 'res://<path>'.",
    });
    this.defineValue(Sprite, "width", { description: "Width in local units." });
    this.defineValue(Sprite, "height", { description: "Height in local units." });
    this.defineValue(Sprite, "alpha", { description: "Opacity 0–1." });
    this.defineValue(Sprite, "tint", { type: ColorAdapter, description: "Tint color (white = none)." });
    this.defineValue(Sprite, "preserveAspectRatio", { description: "Keep original aspect ratio." });

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
      color: this.tint,
      opacity: this.alpha,
      transparent: true,
      alphaTest: resolvedTexture ? 0.01 : 0,
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

    this.fire(SpriteTextureChanged, this);
  }
}
