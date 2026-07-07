/**
 * PhysicsDebug — draws physics collider wireframes as debug lines.
 * Spawn one of these (the editor toggles it) to visualize the physics world.
 */
import { Entity, type EntityContext, EntityDestroyed, GamePostRender } from "@rebur/engine";

export class PhysicsDebug extends Entity {
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
      this.#cleanup();
    });
  }

  get #linesId(): string {
    return `physics-debug/${this.ref}`;
  }

  #render(): void {
    if (!this.game.isClient()) return;

    if (!this.enabled) {
      this.game.renderer.removeDebugLines(this.#linesId);
      return;
    }

    const { vertices, colors } = this.game.physics.debugRender();
    this.game.renderer.setDebugLines(this.#linesId, vertices, colors);
  }

  #cleanup(): void {
    if (!this.game.isClient()) return;
    this.game.renderer.removeDebugLines(this.#linesId);
  }
}
