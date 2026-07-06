import type { AnimatedSprite, Sprite, TilingSprite } from "@rebur/engine";

export class SpriteTextureChanged {
  constructor(public readonly sprite: Sprite | AnimatedSprite | TilingSprite) {}
}
