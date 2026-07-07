/**
 * BoundsDebug — draws entity bounding boxes as editor overlays.
 * In 3D: uses the renderer's BoxHelper-based entity highlight system.
 */
import {
  Entity,
  type EntityContext,
  EntityDestroyed,
  GamePostRender,
} from "@rebur/engine";

export class BoundsDebug extends Entity {
  static {
    Entity.registerType(this, "@editor");
  }

  static readonly icon: string = "🪛";
  readonly bounds: undefined;

  constructor(ctx: EntityContext) {
    super(ctx);

    this.listen(this.game, GamePostRender, () => {
      this.#render();
    });

    this.on(EntityDestroyed, () => {
      this.#clearHighlights();
    });
  }

  #highlighted = new Set<string>();

  #render(): void {
    if (!this.game.isClient()) return;
    const renderer = this.game.renderer;
    if (!renderer.setEntityHighlight) return;

    const current = new Set<string>();
    for (const entity of this.game.entities.all) {
      if (!entity.bounds) continue;
      const ref = entity.ref;
      current.add(ref);
      if (!this.#highlighted.has(ref)) {
        renderer.setEntityHighlight(ref, true, 0x00ff00);
        this.#highlighted.add(ref);
      }
    }

    // Remove highlights for destroyed entities
    for (const ref of this.#highlighted) {
      if (!current.has(ref)) {
        renderer.setEntityHighlight(ref, false);
        this.#highlighted.delete(ref);
      }
    }
  }

  #clearHighlights(): void {
    if (!this.game.isClient()) return;
    const renderer = this.game.renderer;
    if (!renderer.setEntityHighlight) return;
    for (const ref of this.#highlighted) {
      renderer.setEntityHighlight(ref, false);
    }
    this.#highlighted.clear();
  }
}
