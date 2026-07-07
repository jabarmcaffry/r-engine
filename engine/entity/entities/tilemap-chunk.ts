/**
 * TilemapChunk — data-only tile storage for a 256×256 region.
 * No rendering code: rendering is handled by the Tilemap entity using the engine renderer.
 */

export type ChunkType = "atlas" | "color";
export type ChunkId = `${ChunkType}:${number}:${number}`;
export type ChunkInfo = { readonly id: ChunkId; readonly x: number; readonly y: number };

export type TilemapBounds = { minX: number; minY: number; maxX: number; maxY: number };

type TilemapChunkOptions = {
  readonly id: ChunkId;
  readonly x: number;
  readonly y: number;
  readonly type: ChunkType;
};

export abstract class TilemapChunk {
  static readonly CHUNK_SIZE = 256;

  readonly id: ChunkId;
  readonly x: number;
  readonly y: number;
  readonly type: ChunkType;

  abstract get bounds(): Readonly<TilemapBounds>;

  constructor(opts: TilemapChunkOptions) {
    this.id = opts.id;
    this.x = opts.x;
    this.y = opts.y;
    this.type = opts.type;
  }

  abstract getTile(localX: number, localY: number): number | undefined;
  abstract setTile(localX: number, localY: number, id: number | undefined): void;
  abstract serialize(): Uint8Array | undefined;
  abstract deserialize(data: Uint8Array): void;
}

export class TextureTilemapChunk extends TilemapChunk {
  // tile data: Uint16 per cell, 0xFFFF = empty
  #data: Uint16Array = new Uint16Array(TilemapChunk.CHUNK_SIZE * TilemapChunk.CHUNK_SIZE).fill(0xFFFF);
  #minX = Infinity;
  #minY = Infinity;
  #maxX = -Infinity;
  #maxY = -Infinity;

  get bounds(): Readonly<TilemapBounds> {
    return { minX: this.#minX, minY: this.#minY, maxX: this.#maxX, maxY: this.#maxY };
  }

  getTile(localX: number, localY: number): number | undefined {
    const idx = localY * TilemapChunk.CHUNK_SIZE + localX;
    const v = this.#data[idx];
    return v === 0xFFFF ? undefined : v;
  }

  setTile(localX: number, localY: number, id: number | undefined): void {
    const idx = localY * TilemapChunk.CHUNK_SIZE + localX;
    this.#data[idx] = id === undefined ? 0xFFFF : id;
    const wx = this.x * TilemapChunk.CHUNK_SIZE + localX;
    const wy = this.y * TilemapChunk.CHUNK_SIZE + localY;
    if (id !== undefined) {
      this.#minX = Math.min(this.#minX, wx);
      this.#minY = Math.min(this.#minY, wy);
      this.#maxX = Math.max(this.#maxX, wx);
      this.#maxY = Math.max(this.#maxY, wy);
    }
  }

  serialize(): Uint8Array {
    return new Uint8Array(this.#data.buffer);
  }

  deserialize(data: Uint8Array): void {
    this.#data = new Uint16Array(data.buffer, data.byteOffset, data.byteLength / 2);
    // Recalculate bounds
    this.#minX = Infinity; this.#minY = Infinity;
    this.#maxX = -Infinity; this.#maxY = -Infinity;
    for (let y = 0; y < TilemapChunk.CHUNK_SIZE; y++) {
      for (let x = 0; x < TilemapChunk.CHUNK_SIZE; x++) {
        if (this.#data[y * TilemapChunk.CHUNK_SIZE + x] !== 0xFFFF) {
          const wx = this.x * TilemapChunk.CHUNK_SIZE + x;
          const wy = this.y * TilemapChunk.CHUNK_SIZE + y;
          this.#minX = Math.min(this.#minX, wx);
          this.#minY = Math.min(this.#minY, wy);
          this.#maxX = Math.max(this.#maxX, wx);
          this.#maxY = Math.max(this.#maxY, wy);
        }
      }
    }
  }
}

export class ColorTilemapChunk extends TilemapChunk {
  // color data: RGBA u32 per cell, 0 = empty
  #data: Uint32Array = new Uint32Array(TilemapChunk.CHUNK_SIZE * TilemapChunk.CHUNK_SIZE);
  #minX = Infinity;
  #minY = Infinity;
  #maxX = -Infinity;
  #maxY = -Infinity;

  get bounds(): Readonly<TilemapBounds> {
    return { minX: this.#minX, minY: this.#minY, maxX: this.#maxX, maxY: this.#maxY };
  }

  getTile(localX: number, localY: number): number | undefined {
    const v = this.#data[localY * TilemapChunk.CHUNK_SIZE + localX];
    return v === 0 ? undefined : v;
  }

  setTile(localX: number, localY: number, id: number | undefined): void {
    this.#data[localY * TilemapChunk.CHUNK_SIZE + localX] = id ?? 0;
    const wx = this.x * TilemapChunk.CHUNK_SIZE + localX;
    const wy = this.y * TilemapChunk.CHUNK_SIZE + localY;
    if (id !== undefined) {
      this.#minX = Math.min(this.#minX, wx);
      this.#minY = Math.min(this.#minY, wy);
      this.#maxX = Math.max(this.#maxX, wx);
      this.#maxY = Math.max(this.#maxY, wy);
    }
  }

  serialize(): Uint8Array {
    return new Uint8Array(this.#data.buffer);
  }

  deserialize(data: Uint8Array): void {
    this.#data = new Uint32Array(data.buffer, data.byteOffset, data.byteLength / 4);
  }
}

// Aliases kept for backward compatibility
export { TextureTilemapChunk as ClientTextureTilemapChunk };
export { ColorTilemapChunk as ClientColorTilemapChunk };
