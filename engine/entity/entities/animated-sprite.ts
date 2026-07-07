/**
 * AnimatedSprite — a flat plane that cycles through frames of a spritesheet.
 * Replaces the PixiJS AnimatedSprite with a Three.js plane + UV frame animation.
 *
 * Spritesheet layout: frames are arranged left→right, top→bottom.
 * frameDimensions.x/y = pixel size of each frame in the sheet.
 */
import {
  Entity,
  EntitySpawned,
  EntityDestroyed,
  EntityEnableChanged,
  type EntityContext,
  TextureAdapter,
  ColorAdapter,
  SpritesheetAdapter,
  Vector2,
  Vector2Adapter,
  type IBounds,
  Bounds,
  SpriteTextureChanged,
} from "@rebur/engine";
import type { MeshHandle, GeometryDesc, MaterialDesc } from "../../renderer/api.ts";

export class AnimatedSprite extends Entity {
  static {
    Entity.registerType(this, "@core");
  }

  static readonly icon = "🖼️";

  width: number = 1;
  height: number = 1;
  spritesheet: string = "";
  jsonSpritesheet: string = "";
  frameDimensions: Vector2 = new Vector2(128, 128);
  alpha: number = 1;
  tint: string = "white";
  speed: number = 0.1;
  loop: boolean = true;
  startFrame: number = 0;
  endFrame: number = -1;
  totalFrames: number = 0;

  #meshHandle: MeshHandle | undefined;
  #currentFrame: number = 0;
  #elapsed: number = 0;
  /** Pixel size of the loaded spritesheet. Updated when the image loads. */
  #sheetWidth: number = 0;
  #sheetHeight: number = 0;

  get bounds(): IBounds | undefined {
    return new Bounds(this.width, this.height);
  }

  constructor(ctx: EntityContext) {
    super(ctx);

    this.defineValue(AnimatedSprite, "spritesheet", {
      type: SpritesheetAdapter,
      sortOrder: 50,
      description: "Spritesheet image path (res://).",
    });
    this.defineValue(AnimatedSprite, "jsonSpritesheet", {
      sortOrder: 49,
      description: "Optional JSON atlas descriptor for the spritesheet.",
    });
    this.defineValue(AnimatedSprite, "frameDimensions", {
      type: Vector2Adapter,
      sortOrder: 48,
      description: "Pixel width/height of one frame in the spritesheet.",
    });
    this.defineValue(AnimatedSprite, "speed", {
      sortOrder: 50,
      description: "Frames per second (before speed multiplier).",
    });
    this.defineValue(AnimatedSprite, "loop", { sortOrder: 40, description: "Loop animation." });
    this.defineValue(AnimatedSprite, "startFrame", { description: "First frame index (0-based)." });
    this.defineValue(AnimatedSprite, "endFrame", { description: "Last frame index (-1 = all frames)." });
    this.defineValue(AnimatedSprite, "totalFrames", { description: "Total frames (0 = auto-detect)." });
    this.defineValue(AnimatedSprite, "width", { sortOrder: 30, description: "Width in local units." });
    this.defineValue(AnimatedSprite, "height", { sortOrder: 20, description: "Height in local units." });
    this.defineValue(AnimatedSprite, "alpha", { sortOrder: 10, description: "Opacity 0–1." });
    this.defineValue(AnimatedSprite, "tint", {
      type: ColorAdapter,
      sortOrder: 9,
      description: "Tint color.",
    });

    this.on(EntitySpawned, () => {
      const game = this.game;
      if (!game.isClient()) return;
      this.#currentFrame = this.startFrame;

      this.#meshHandle = game.renderer.createMesh(
        this.ref,
        this.#buildGeometry(),
        this.#buildMaterial(),
      );
      this.#syncTransform();

      // Preload texture to get sheet dimensions
      if (this.spritesheet) {
        const img = new Image();
        img.onload = () => {
          this.#sheetWidth = img.naturalWidth;
          this.#sheetHeight = img.naturalHeight;
        };
        img.src = game.resolveResource(this.spritesheet);
      }
    });

    this.on(EntityDestroyed, () => {
      if (!this.game.isClient() || this.#meshHandle === undefined) return;
      this.game.renderer.destroyMesh(this.#meshHandle);
    });

    this.on(EntityEnableChanged, ({ enabled }) => {
      if (!this.game.isClient() || this.#meshHandle === undefined) return;
      this.game.renderer.setMeshVisible(this.#meshHandle, enabled);
      if (enabled) this.#currentFrame = this.startFrame;
    });
  }

  #buildGeometry(): GeometryDesc {
    return { type: "plane", width: this.width, height: this.height };
  }

  #frameUV(): { uvRepeat: { x: number; y: number }; uvOffset: { x: number; y: number } } {
    const fw = this.frameDimensions.x;
    const fh = this.frameDimensions.y;
    const sw = this.#sheetWidth || fw;
    const sh = this.#sheetHeight || fh;

    const cols = Math.max(1, Math.floor(sw / fw));
    const rows = Math.max(1, Math.floor(sh / fh));

    const frame = this.#currentFrame;
    const col = frame % cols;
    const row = Math.floor(frame / cols);

    return {
      uvRepeat: { x: 1 / cols, y: 1 / rows },
      uvOffset: { x: col / cols, y: 1 - (row + 1) / rows },
    };
  }

  #buildMaterial(): MaterialDesc {
    const resolvedSheet = this.spritesheet
      ? this.game.resolveResource(this.spritesheet)
      : undefined;
    const { uvRepeat, uvOffset } = this.#frameUV();
    return {
      type: "unlit",
      texture: resolvedSheet,
      color: this.tint,
      opacity: this.alpha,
      transparent: true,
      alphaTest: resolvedSheet ? 0.01 : 0,
      side: "double",
      uvRepeat,
      uvOffset,
    };
  }

  #syncTransform(): void {
    if (!this.game.isClient() || this.#meshHandle === undefined) return;
    const t = this.globalTransform;
    this.game.renderer.setMeshTransform(this.#meshHandle, t.position, t.rotation, t.scale);
  }

  onFrame(): void {
    if (!this.game.isClient() || this.#meshHandle === undefined) return;
    if (!this.game.paused.value) {
      this.#advanceFrame();
    }
    this.#syncTransform();
    this.game.renderer.updateMeshGeometry(this.#meshHandle, this.#buildGeometry());
    this.game.renderer.updateMeshMaterial(this.#meshHandle, this.#buildMaterial());

    this.fire(SpriteTextureChanged, this);
  }

  #advanceFrame(): void {
    const fps = Math.max(0.001, this.speed * 24);
    this.#elapsed += this.game.time.delta;
    const frameDuration = 1000 / fps;

    while (this.#elapsed >= frameDuration) {
      this.#elapsed -= frameDuration;

      const fw = this.frameDimensions.x;
      const sw = this.#sheetWidth || fw;
      const fh = this.frameDimensions.y;
      const sh = this.#sheetHeight || fh;
      const cols = Math.max(1, Math.floor(sw / fw));
      const rows = Math.max(1, Math.floor(sh / fh));
      const total = this.totalFrames > 0 ? this.totalFrames : cols * rows;
      const lastFrame = this.endFrame >= 0 ? Math.min(this.endFrame, total - 1) : total - 1;

      this.#currentFrame++;
      if (this.#currentFrame > lastFrame) {
        if (this.loop) {
          this.#currentFrame = this.startFrame;
        } else {
          this.#currentFrame = lastFrame;
        }
      }
    }
  }
}
