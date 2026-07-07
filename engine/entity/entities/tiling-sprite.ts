/**
 * TilingSprite — a flat plane whose texture tiles/repeats.
 * Replaces the PixiJS TilingSprite with a Three.js plane + UV repeat.
 */
import {
  Entity,
  EntitySpawned,
  EntityDestroyed,
  EntityEnableChanged,
  type EntityContext,
  TextureAdapter,
  ColorAdapter,
  Vector2Adapter,
  Vector2,
  type IBounds,
  Bounds,
  SpriteTextureChanged,
} from "@rebur/engine";
import type { MeshHandle, GeometryDesc, MaterialDesc } from "../../renderer/api.ts";

export class TilingSprite extends Entity {
  static {
    Entity.registerType(this, "@core");
  }

  static readonly icon = "🖼️";

  width: number = 1;
  height: number = 1;
  texture: string = "";
  alpha: number = 1;
  tint: string = "white";
  tilePosition: Vector2 = Vector2.ZERO;
  tileRotation: number = 0;
  tileScale: Vector2 = Vector2.ONE;

  #meshHandle: MeshHandle | undefined;

  get bounds(): IBounds | undefined {
    return new Bounds(this.width, this.height);
  }

  constructor(ctx: EntityContext) {
    super(ctx);

    this.defineValue(TilingSprite, "width", { description: "Width in world units." });
    this.defineValue(TilingSprite, "height", { description: "Height in world units." });
    this.defineValue(TilingSprite, "alpha", { description: "Opacity 0–1." });
    this.defineValue(TilingSprite, "tint", { type: ColorAdapter, description: "Tint color." });
    this.defineValue(TilingSprite, "tilePosition", {
      type: Vector2Adapter,
      description: "UV scroll offset (0–1 per axis).",
    });
    this.defineValue(TilingSprite, "tileRotation", { description: "Tile texture rotation (radians)." });
    this.defineValue(TilingSprite, "tileScale", {
      type: Vector2Adapter,
      description: "Tile repeat scale (1 = one repeat over the whole surface).",
    });
    this.defineValue(TilingSprite, "texture", {
      type: TextureAdapter,
      sortOrder: 10,
      description: "Texture to tile. Drag from project panel or type 'res://<path>'.",
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
      color: this.tint,
      opacity: this.alpha,
      transparent: this.alpha < 1,
      alphaTest: resolvedTexture ? 0.01 : 0,
      side: "double",
      // tileScale.x/y = how many repeats across the surface
      uvRepeat: resolvedTexture
        ? { x: 1 / Math.max(0.001, this.tileScale.x), y: 1 / Math.max(0.001, this.tileScale.y) }
        : undefined,
      uvOffset: resolvedTexture
        ? { x: this.tilePosition.x, y: this.tilePosition.y }
        : undefined,
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
