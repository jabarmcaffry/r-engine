/**
 * Howler.js audio backend.
 *
 * This is the ONLY file in the engine that imports Howler directly.
 * All game code talks exclusively to IAudioBackend.
 * Swapping to Web Audio API or another library means replacing this file only.
 */

import { Howl, Howler } from "@rebur/vendor/howler.ts";
import type { IAudioBackend, AudioHandle, AudioSourceDesc } from "../../api.ts";
import type { IVec3 } from "../../../math/vec3.ts";

export class HowlerAudioBackend implements IAudioBackend {
  #counter = 1;
  readonly #sounds = new Map<AudioHandle, Howl>();

  createSource(_entityRef: string, desc: AudioSourceDesc): AudioHandle {
    const howl = new Howl({
      src: [desc.url],
      loop: desc.loop ?? false,
      volume: desc.volume ?? 1,
      autoplay: desc.autoplay ?? false,
    });
    const handle = this.#counter++ as unknown as AudioHandle;
    this.#sounds.set(handle, howl);
    return handle;
  }

  destroySource(handle: AudioHandle): void {
    const howl = this.#sounds.get(handle);
    if (howl) {
      howl.unload();
      this.#sounds.delete(handle);
    }
  }

  play(handle: AudioHandle): void { this.#sounds.get(handle)?.play(); }
  pause(handle: AudioHandle): void { this.#sounds.get(handle)?.pause(); }
  stop(handle: AudioHandle): void { this.#sounds.get(handle)?.stop(); }

  setVolume(handle: AudioHandle, volume: number): void {
    this.#sounds.get(handle)?.volume(volume);
  }

  setLoop(handle: AudioHandle, loop: boolean): void {
    this.#sounds.get(handle)?.loop(loop);
  }

  setPosition(handle: AudioHandle, pos: IVec3): void {
    // Howler 3D positional audio
    const h = this.#sounds.get(handle);
    if (h && typeof h.pos === "function") h.pos(pos.x, pos.y, pos.z);
  }

  isPlaying(handle: AudioHandle): boolean {
    return this.#sounds.get(handle)?.playing() ?? false;
  }

  setListenerPosition(pos: IVec3): void {
    Howler.pos(pos.x, pos.y, pos.z);
  }

  setListenerOrientation(forward: IVec3, up: IVec3): void {
    Howler.orientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
  }

  setMasterVolume(volume: number): void {
    Howler.volume(volume);
  }

  suspend(): void {
    if (Howler.ctx) Howler.ctx.suspend();
  }

  resume(): void {
    if (Howler.ctx) Howler.ctx.resume();
  }

  dispose(): void {
    for (const howl of this.#sounds.values()) howl.unload();
    this.#sounds.clear();
  }
}
