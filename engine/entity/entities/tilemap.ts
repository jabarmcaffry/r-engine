/**
 * Tilemap — a grid of tiles rendered using Three.js plane meshes with atlas UV mapping.
 *
 * Tile data is stored as a flat Uint16Array per chunk (256×256 grid of tile IDs).
 * Each chunk tracks its tile data server-side and client-side.
 * Rendering in 3D uses the base renderer's plane meshes with UV atlas sampling.
 *
 * For a 3D engine the tilemap renders as a flat plane. The Tilemap entity can be
 * rotated/translated like any other entity.
 */
import {
  Entity,
  type EntityContext,
  EntityDestroyed,
  type IBounds,
  TextureAdapter,
  TilemapBatchUpdate,
  TilemapClear,
  TilemapUpdate,
  Vector2,
  pointWorldToLocal,
} from "@rebur/engine";
import { decodeCBOR, encodeCBOR } from "@rebur/vendor/exp-fast-cbor.ts";
import { gzip, ungzip } from "@rebur/vendor/pako.ts";
import { decodeBase64Url, encodeBase64Url } from "@rebur/vendor/std__encoding.ts";
import type { JsonValue } from "../../value/data.ts";
import type { ChunkId, ChunkType } from "./tilemap-chunk.ts";
import {
  ColorTilemapChunk,
  TextureTilemapChunk,
  TilemapChunk,
} from "./tilemap-chunk.ts";

export type TileInfo =
  | { readonly type: "atlas"; readonly id: number }
  | { readonly type: "color"; readonly color: number };

export abstract class BaseTilemap extends Entity {
  static readonly icon = "🗺️";

  #boundsCache: IBounds = { width: 1, height: 1 };
  get bounds(): IBounds | undefined {
    return { ...this.#boundsCache };
  }

  atlas: string = "";
  resolution: number = 64;
  alpha: number = 1;

  #boundsDirty: boolean = false;
  #chunks = new Map<ChunkId, TilemapChunk>();

  constructor(ctx: EntityContext) {
    super(ctx);

    this.defineValue(BaseTilemap, "atlas", {
      type: TextureAdapter,
      sortOrder: 10,
      description: "Tile atlas texture path.",
    });
    this.defineValue(BaseTilemap, "resolution", {
      description: "Pixels per tile in the atlas.",
    });
    this.defineValue(BaseTilemap, "alpha", {
      description: "Tilemap opacity 0–1.",
    });

    this.on(TilemapUpdate, ({ x, y, tile }) => {
      this.#setTileInternal(x, y, tile !== undefined ? { type: "atlas", id: tile } : undefined);
    });

    this.on(TilemapBatchUpdate, ({ tiles }) => {
      for (const [x, y, tile] of tiles) {
        this.#setTileInternal(x, y, tile !== undefined ? { type: "atlas", id: tile } : undefined);
      }
    });

    this.on(TilemapClear, () => {
      this.#chunks.clear();
      this.#boundsDirty = true;
    });

    this.on(EntityDestroyed, () => {
      this.#chunks.clear();
    });
  }

  // #region tile coordinate helpers

  getTileCoordinatesAtPoint(world: Vector2): Vector2 {
    const local = pointWorldToLocal(this.globalTransform, world);
    return new Vector2(Math.floor(local.x + 0.5), Math.floor(local.y + 0.5));
  }

  getTile(x: number, y: number): number | undefined {
    const info = this.getTileInfo(x, y);
    if (info?.type !== "atlas") return undefined;
    return info.id;
  }

  getTileInfo(x: number, y: number): TileInfo | undefined {
    const { chunkX, chunkY, id } = this.#chunkCoords("atlas", x, y);
    const chunk = this.#chunks.get(id);
    if (!chunk) return undefined;
    const localX = x - chunkX * TilemapChunk.CHUNK_SIZE;
    const localY = y - chunkY * TilemapChunk.CHUNK_SIZE;
    const tileId = chunk.getTile(localX, localY);
    if (tileId === undefined) return undefined;
    return { type: "atlas", id: tileId };
  }

  setTiles(
    xs: number[],
    ys: number[],
    atlasIds: (number | undefined)[] | Uint8Array | Uint16Array,
  ): void {
    if (xs.length !== ys.length || xs.length !== atlasIds.length) {
      throw new Error("xs, ys, and atlasIds must have the same length");
    }
    const updates: [number, number, number | undefined][] = [];
    for (let i = 0; i < xs.length; i++) {
      const id = atlasIds[i] as number | undefined;
      this.#setTileInternal(xs[i], ys[i], id !== undefined ? { type: "atlas", id } : undefined);
      updates.push([xs[i], ys[i], id]);
    }
    this.fire(TilemapBatchUpdate, { tiles: updates });
  }

  setTile(x: number, y: number, atlasId: number | undefined): void {
    this.#setTileInternal(x, y, atlasId !== undefined ? { type: "atlas", id: atlasId } : undefined);
    this.fire(TilemapUpdate, { x, y, tile: atlasId });
  }

  clearTiles(): void {
    this.#chunks.clear();
    this.#boundsDirty = true;
    this.fire(TilemapClear);
  }

  // #endregion

  #chunkCoords(type: ChunkType, x: number, y: number): { chunkX: number; chunkY: number; id: ChunkId } {
    const chunkX = Math.floor(x / TilemapChunk.CHUNK_SIZE);
    const chunkY = Math.floor(y / TilemapChunk.CHUNK_SIZE);
    return { chunkX, chunkY, id: `${type}:${chunkX}:${chunkY}` as ChunkId };
  }

  #setTileInternal(x: number, y: number, info: TileInfo | undefined): void {
    const { chunkX, chunkY, id } = this.#chunkCoords("atlas", x, y);
    let chunk = this.#chunks.get(id);
    if (!chunk) {
      if (info === undefined) return;
      chunk = new TextureTilemapChunk({ id, x: chunkX, y: chunkY, type: "atlas" });
      this.#chunks.set(id, chunk);
    }
    const localX = x - chunkX * TilemapChunk.CHUNK_SIZE;
    const localY = y - chunkY * TilemapChunk.CHUNK_SIZE;
    chunk.setTile(localX, localY, info?.type === "atlas" ? info.id : undefined);
    this.#boundsDirty = true;
  }

  #recalculateBounds(): void {
    if (this.#chunks.size === 0) {
      this.#boundsCache = { width: 1, height: 1 };
      return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const chunk of this.#chunks.values()) {
      const b = chunk.bounds;
      if (b.minX !== Infinity) {
        minX = Math.min(minX, b.minX);
        minY = Math.min(minY, b.minY);
        maxX = Math.max(maxX, b.maxX);
        maxY = Math.max(maxY, b.maxY);
      }
    }
    if (minX === Infinity) {
      this.#boundsCache = { width: 1, height: 1 };
    } else {
      this.#boundsCache = {
        width: maxX - minX + 1,
        height: maxY - minY + 1,
        offset: new Vector2((minX + maxX) / 2, (minY + maxY) / 2),
      };
    }
  }

  onUpdate(): void {
    super.onUpdate();
    if (this.#boundsDirty) {
      this.#recalculateBounds();
      this.#boundsDirty = false;
    }
  }

  // #region serialization

  // deno-lint-ignore no-explicit-any
  protected override saveDataForScene(): JsonValue {
    return this.#serialize();
  }

  // deno-lint-ignore no-explicit-any
  protected override loadDataForScene(value: JsonValue | undefined): void {
    if (typeof value !== "string") return;
    const buffer = decodeBase64Url(value);
    this.#deserialize(buffer);
  }

  #serialize(): string {
    const chunkData: [ChunkId, Uint8Array][] = [];
    for (const [id, chunk] of this.#chunks) {
      const data = chunk.serialize();
      if (data) chunkData.push([id, data]);
    }
    const encoded = encodeCBOR(chunkData);
    const compressed = gzip(encoded);
    return encodeBase64Url(compressed);
  }

  #deserialize(buffer: Uint8Array): void {
    const decompressed = ungzip(buffer);
    const chunkData = decodeCBOR(decompressed) as [ChunkId, Uint8Array][];
    this.#chunks.clear();
    for (const [id, data] of chunkData) {
      const [type, sx, sy] = id.split(":") as [ChunkType, string, string];
      const x = parseInt(sx, 10);
      const y = parseInt(sy, 10);
      const chunk = type === "atlas"
        ? new TextureTilemapChunk({ id, x, y, type })
        : new ColorTilemapChunk({ id, x, y, type });
      chunk.deserialize(data);
      this.#chunks.set(id, chunk);
    }
    this.#boundsDirty = true;
  }

  // #endregion
}

export class Tilemap extends BaseTilemap {
  static {
    Entity.registerType(this, "@core");
  }
}
