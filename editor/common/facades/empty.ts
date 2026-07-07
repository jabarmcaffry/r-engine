import {
  Camera,
  ClientGame,
  Empty,
  Entity,
  EntityContext,
  EntityDestroyed,
  EntityReparented,
  IBounds,
  Value,
} from "@rebur/engine";
import type { MeshHandle } from "@rebur/engine";
import { EditorFacadeComplexCollider } from "./complex-collider.ts";
import { Facades } from "./manager.ts";
import { SelectedEntityService } from "../../client/ui/selected-entity.ts";

/** Size of the vertex marker sphere (local units). */
const MARKER_RADIUS = 0.08;

export class EmptyFacade extends Entity {
  static readonly icon: string = Empty.icon;

  static {
    Entity.registerType(this, "@editor");
    Facades.register(Empty, this);
  }

  public isFolder: boolean = false;

  get icon(): string {
    return this.isFolder ? "🗂️" : Empty.icon;
  }

  get isColliderChildAndSelected(): boolean {
    const selectedService = SelectedEntityService.serviceForGame(this.game as ClientGame);
    if (!selectedService) return false;
    return (
      this.parent instanceof EditorFacadeComplexCollider &&
      (selectedService.entities.includes(this.parent) ||
        selectedService.entities.some(e => e.parent === this.parent))
    );
  }

  get bounds(): IBounds | undefined {
    if (this.isColliderChildAndSelected) {
      const d = MARKER_RADIUS * 2;
      return { width: d, height: d };
    }
    return undefined;
  }

  // Marker sphere shown when this is a vertex of a selected ComplexCollider.
  #markerHandle: MeshHandle | undefined;

  #selectionListener: { unsubscribe: () => void } | undefined;
  #zoomFn: [Value<number>, () => void] | undefined;

  constructor(ctx: EntityContext) {
    super(ctx);

    this.defineValue(EmptyFacade, "isFolder", {
      hidden: _ => {
        return !this.id.startsWith("world/EditEntities/prefabs");
      },
      description: "Marks this empty as a folder for organizing prefabs",
      replicated: true,
      persistent: true,
    });

    // Track camera zoom so marker size stays consistent in screen space.
    const camera = Camera.getActive(this.game);
    const zoom = camera?.values.get("zoom");
    if (zoom) {
      const fn = () => this.#updateMarker();
      this.#zoomFn = [zoom as Value<number>, fn];
      zoom.onChanged(fn);
    }

    this.on(EntityDestroyed, () => {
      if (this.#zoomFn) {
        const [zoom, fn] = this.#zoomFn;
        zoom.removeChangeListener(fn);
        this.#zoomFn = undefined;
      }
      this.#selectionListener?.unsubscribe();
      this.#destroyMarker();
    });

    this.on(EntityReparented, () => this.#updateMarker());
  }

  onInitialize(): void {
    super.onInitialize();

    if (!this.game.isClient()) return;

    setTimeout(() => {
      const selectedService = SelectedEntityService.serviceForGame(this.game as ClientGame);
      this.#selectionListener = selectedService?.listen(() => this.#updateMarker());
      this.#updateMarker();
    });
  }

  #updateMarker(): void {
    if (!this.game.isClient()) return;

    if (this.isColliderChildAndSelected) {
      if (!this.#markerHandle) {
        const t = this.globalTransform;
        this.#markerHandle = this.game.renderer.createMesh(
          `__empty_marker_${this.ref}`,
          { type: "sphere", radius: MARKER_RADIUS, segments: 8 },
          { color: "#ffcf36", transparent: false, wireframe: false },
        );
        this.game.renderer.setMeshTransform(
          this.#markerHandle,
          t.position,
          t.rotation,
          { x: 1, y: 1, z: 1 },
        );
        this.game.renderer.setMeshVisible(this.#markerHandle, this.enabled);
      }
    } else {
      this.#destroyMarker();
    }
  }

  #destroyMarker(): void {
    if (this.#markerHandle !== undefined) {
      this.game.renderer.destroyMesh(this.#markerHandle);
      this.#markerHandle = undefined;
    }
  }
}
