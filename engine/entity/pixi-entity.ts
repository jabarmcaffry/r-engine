/**
 * PixiEntity — REMOVED.
 *
 * This class used to be the base for all 2D PixiJS entities.
 * The 3D migration replaced all PixiJS entities with Three.js-backed equivalents.
 * This file is kept as an empty stub so that any remaining `instanceof PixiEntity`
 * checks in editor code compile, but the class has no runtime behaviour.
 *
 * TODO: Remove this file once all instanceof PixiEntity checks are removed from
 *       the editor (prefab-viewer.tsx etc.).
 */
import { Entity } from "./entity.ts";

/** @deprecated All entities now use the Three.js backend. Use Entity instead. */
export abstract class PixiEntity extends Entity {
  /** @deprecated No-op in 3D. */
  // deno-lint-ignore no-explicit-any
  readonly container: any = undefined;
}
