import type { IVec3 } from "../math/vec3.ts";

// ---------------------------------------------------------------------------
// Opaque handle
// ---------------------------------------------------------------------------
export type AudioHandle = number & { readonly _brand: "AudioHandle" };

// ---------------------------------------------------------------------------
// Descriptor types
// ---------------------------------------------------------------------------
export interface AudioSourceDesc {
  url: string;
  loop?: boolean;
  volume?: number;    // 0–1
  /** If set, audio attenuates with distance from listenerPosition. */
  spatial?: boolean;
  refDistance?: number;
  maxDistance?: number;
  rolloffFactor?: number;
  autoplay?: boolean;
}

// ---------------------------------------------------------------------------
// The contract every audio backend must fulfill.
// AudioSource entity type imports ONLY this interface.
// ---------------------------------------------------------------------------
export interface IAudioBackend {
  // ---- Source management -------------------------------------------------
  createSource(entityRef: string, desc: AudioSourceDesc): AudioHandle;
  destroySource(handle: AudioHandle): void;

  // ---- Playback ----------------------------------------------------------
  play(handle: AudioHandle): void;
  pause(handle: AudioHandle): void;
  stop(handle: AudioHandle): void;

  // ---- State -------------------------------------------------------------
  setVolume(handle: AudioHandle, volume: number): void;
  setLoop(handle: AudioHandle, loop: boolean): void;
  setPosition(handle: AudioHandle, pos: IVec3): void;
  isPlaying(handle: AudioHandle): boolean;

  // ---- Listener ----------------------------------------------------------
  setListenerPosition(pos: IVec3): void;
  setListenerOrientation(forward: IVec3, up: IVec3): void;

  // ---- Lifecycle ---------------------------------------------------------
  setMasterVolume(volume: number): void;
  suspend(): void;
  resume(): void;
  dispose(): void;
}
