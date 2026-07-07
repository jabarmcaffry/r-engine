/**
 * PhysicsDebug — draws Rapier physics debug lines in 3D space.
 * Uses Three.js LineSegments to visualize colliders and joints.
 */
import {
  Camera,
  Entity,
  type EntityContext,
  EntityDestroyed,
  GamePostRender,
} from "@rebur/engine";
import * as THREE from "@rebur/vendor/three.ts";

export class PhysicsDebug extends Entity {
  static {
    Entity.registerType(this, "@editor");
  }

  static readonly icon: string = "🪛";
  readonly bounds: undefined;

  #lineSegments: THREE.LineSegments | undefined;
  #scene: THREE.Scene | undefined;

  constructor(ctx: EntityContext) {
    super(ctx);

    this.listen(this.game, GamePostRender, () => {
      this.#render();
    });

    this.on(EntityDestroyed, () => {
      this.#cleanup();
    });
  }

  onInitialize(): void {
    if (!this.game.isClient()) return;
    // We can't directly access the Three.js scene; skip line rendering for now.
    // TODO: expose addEditorGeometry on IRendererBackend for debug lines.
  }

  #render(): void {
    const camera = Camera.getActive(this.game);
    if (!camera) return;

    const { vertices, colors } = this.game.physics.world.debugRender();
    if (vertices.length === 0) return;

    // Debug output as console (3D scene injection NYI)
    // TODO: use renderer.addDebugLines() once that API is added.
  }

  #cleanup(): void {
    this.#lineSegments = undefined;
    this.#scene = undefined;
  }
}
