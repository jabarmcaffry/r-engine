/**
 * UILayer — HTML/CSS overlay for the 3D scene.
 * On EntitySpawned (client only) the root div is appended to the game container,
 * positioned to fill the canvas. UIBehaviors mount their DOM trees into this element.
 */
import {
  Entity,
  EntitySpawned,
  EntityDestroyed,
  type EntityContext,
  type ClientGame,
} from "@rebur/engine";

export class UILayer extends Entity {
  static {
    Entity.registerType(this, "@core");
  }
  static readonly icon: string = "🗂";
  get bounds() { return undefined; }

  #element: HTMLDivElement | undefined;
  /** Root HTML element for UI children. Lazily created on first access. */
  get element(): HTMLDivElement {
    if (!this.#element) {
      this.#element = document.createElement("div");
      this.#element.style.cssText =
        "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:hidden;";
    }
    return this.#element;
  }

  constructor(ctx: EntityContext) {
    super(ctx);

    this.on(EntitySpawned, () => {
      if (!this.game.isClient()) return;
      const container = (this.game as ClientGame).container;
      // Ensure the container is positioned so absolute children work correctly
      if (container.style.position === "") container.style.position = "relative";
      container.appendChild(this.element);
    });

    this.on(EntityDestroyed, () => {
      this.#element?.remove();
    });
  }
}
