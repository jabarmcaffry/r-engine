import {
  Entity,
  EntitySpawned,
  EntityDestroyed,
  EntityEnableChanged,
  type EntityContext,
} from "@rebur/engine";
import type { AudioHandle } from "../../audio/api.ts";

export class AudioSource extends Entity {
  static {
    Entity.registerType(this, "@core");
  }

  static readonly icon = "🔊";

  clip: string = "";
  volume: number = 1;
  loop: boolean = false;
  autoplay: boolean = false;
  spatial: boolean = false;
  refDistance: number = 1;
  maxDistance: number = 40;

  #audioHandle: AudioHandle | undefined;

  get bounds() { return undefined; }

  constructor(ctx: EntityContext) {
    super(ctx);

    this.defineValue(AudioSource, "clip", { description: "Audio file URL or res:// URI." });
    this.defineValue(AudioSource, "volume", { description: "Volume 0–1." });
    this.defineValue(AudioSource, "loop", { description: "Loop playback." });
    this.defineValue(AudioSource, "autoplay", { description: "Play on spawn." });
    this.defineValue(AudioSource, "spatial", { description: "3D positional audio." });
    this.defineValue(AudioSource, "refDistance", { description: "Full-volume distance." });
    this.defineValue(AudioSource, "maxDistance", { description: "Silent distance." });

    this.on(EntitySpawned, () => {
      const game = this.game;
      if (!game.isClient() || !this.clip) return;
      const url = game.resolveResource(this.clip);
      this.#audioHandle = game.audio.createSource(this.ref, {
        url,
        loop: this.loop,
        volume: this.volume,
        autoplay: this.autoplay,
        spatial: this.spatial,
        refDistance: this.refDistance,
        maxDistance: this.maxDistance,
      });
    });

    this.on(EntityDestroyed, () => {
      const game = this.game;
      if (!game.isClient() || this.#audioHandle === undefined) return;
      game.audio.destroySource(this.#audioHandle);
    });

    this.on(EntityEnableChanged, ({ enabled }) => {
      const game = this.game;
      if (!game.isClient() || this.#audioHandle === undefined) return;
      if (!enabled) game.audio.stop(this.#audioHandle);
    });
  }

  play(): void {
    const game = this.game;
    if (!game.isClient() || this.#audioHandle === undefined) return;
    game.audio.play(this.#audioHandle);
  }

  pause(): void {
    const game = this.game;
    if (!game.isClient() || this.#audioHandle === undefined) return;
    game.audio.pause(this.#audioHandle);
  }

  stop(): void {
    const game = this.game;
    if (!game.isClient() || this.#audioHandle === undefined) return;
    game.audio.stop(this.#audioHandle);
  }

  isPlaying(): boolean {
    const game = this.game;
    if (!game.isClient() || this.#audioHandle === undefined) return false;
    return game.audio.isPlaying(this.#audioHandle);
  }

  onFrame(): void {
    const game = this.game;
    if (!game.isClient() || !this.spatial || this.#audioHandle === undefined) return;
    game.audio.setPosition(this.#audioHandle, this.globalTransform.position);
  }
}
