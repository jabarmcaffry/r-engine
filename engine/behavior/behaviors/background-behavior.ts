/**
 * BackgroundBehavior — parallax scrolling background.
 *
 * TODO: 3D migration — the 2D Sprite/TilingSprite-based implementation has been
 * disabled. A 3D equivalent (e.g. a large plane mesh that tracks the camera) is
 * needed before this behavior is usable again.
 */
import { Behavior, BehaviorContext, Vector2, Vector2Adapter } from "@rebur/engine";

export class BackgroundBehavior extends Behavior {
  parallax: Vector2 = Vector2.ZERO;

  constructor(ctx: BehaviorContext) {
    super(ctx);
    this.defineValue(BackgroundBehavior, "parallax", { type: Vector2Adapter });
  }

  onInitialize(): void {
    // TODO: 3D migration — disabled; was initialising a Sprite/TilingSprite origin
  }

  onFrame(): void {
    // TODO: 3D migration — disabled; was using 2D Sprite/TilingSprite APIs and
    // camera.smoothed.position which do not exist in the 3D renderer.
  }
}
// game[internal.behaviorLoader].registerInternalBehavior(BackgroundBehavior, "@core");
