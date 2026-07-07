import {
  AspectRatioAdapter,
  Camera,
  Entity,
  EntityContext,
  EntityDestroyed,
  enumAdapter,
  Vector2,
} from "@rebur/engine";
import {
  InitSelectedEntityService,
  SelectedEntityService,
} from "../../client/ui/selected-entity.ts";
import { EnsureCompatible, EntityValueProps } from "./_compatibility.ts";
import { DebugSquare } from "./_debug.ts";
import { Facades } from "./manager.ts";

type ScaleFilterMode = enumAdapter.Union<typeof ScaleFilterModeAdapter>;
const ScaleFilterModeAdapter = enumAdapter(["linear", "nearest"]);

export class EditorFacadeCamera extends Entity {
  static {
    Entity.registerType(this, "@editor");
    Facades.register(Camera, this);
  }

  static readonly icon = Camera.icon;
  readonly bounds: undefined;

  public smooth: number = 0.1;
  public unlocked: boolean = false;
  public active: boolean = false;
  public zoom: number = 1;
  public fov: number = 75;
  public near: number = 0.1;
  public far: number = 1000;
  public showBounds: boolean = false;
  public lockAspectRatio: boolean = false;
  public aspectRatio: readonly [number, number] = [1, 1];
  public scaleFilterMode: ScaleFilterMode = "nearest";

  #selected: boolean = false;
  #updateShowBounds() {
    if (!this.#debug) return;
    this.#debug.enabled = this.#selected || this.showBounds;
  }

  #debug: DebugSquare | undefined;
  #debugListener: { unsubscribe: () => void } | undefined;

  constructor(ctx: EntityContext) {
    super(ctx);
    this.defineValue(EditorFacadeCamera, "showBounds", {
      replicated: false,
      persistent: false,
      description: "Controls whether the camera bounds are visible in the editor.",
    });

    this.defineValue(EditorFacadeCamera, "active", {
      description: "Indicates if the camera is active in the editor.",
    });

    this.defineValue(EditorFacadeCamera, "fov", {
      description: "Vertical field of view in degrees.",
    });
    this.defineValue(EditorFacadeCamera, "near", {
      description: "Near clipping plane.",
    });
    this.defineValue(EditorFacadeCamera, "far", {
      description: "Far clipping plane.",
    });
    this.defineValue(EditorFacadeCamera, "smooth", {
      description: "Controls the smoothness of the camera movement.",
    });

    this.defineValue(EditorFacadeCamera, "unlocked", {
      description: "Determines whether the camera is locked or can be moved freely.",
    });

    this.defineValue(EditorFacadeCamera, "zoom", {
      description: "Sets the zoom level of the camera.",
    });

    this.defineValue(EditorFacadeCamera, "lockAspectRatio", {
      description: "Locks the camera's aspect ratio during resizing.",
    });

    this.defineValue(EditorFacadeCamera, "aspectRatio", {
      type: AspectRatioAdapter,
      hidden: values => values.get("lockAspectRatio")?.value === false,
      description:
        "Defines the aspect ratio of the camera view. Hidden when aspect ratio locking is disabled.",
    });

    this.defineValue(EditorFacadeCamera, "scaleFilterMode", {
      type: ScaleFilterModeAdapter,
      description: "Sets the scale filter mode for the camera view (e.g., nearest or linear).",
    });

    if (this.game.isClient()) {
      const svc = SelectedEntityService.serviceForGame(this.game);
      if (svc) {
        this.#onSelectedSvc(svc);
      } else {
        this.listen(this.game, InitSelectedEntityService, ({ svc }) => {
          this.#onSelectedSvc(svc);
        });
      }
    }

    this.on(EntityDestroyed, () => {
      this.#debugListener?.unsubscribe();
    });
  }

  onInitialize(): void {
    super.onInitialize();
    if (!this.game.isClient()) return;

    this.#debug = new DebugSquare({
      entity: this,
      enabled: false,
      disableScale: true,
      suffix: this.active ? " (active)" : "",
      getBounds: () => {
        const vec = Vector2.splat(Camera.TARGET_VIEWPORT_SIZE).div(this.zoom);
        const [w, h] = this.aspectRatio;
        const r = w / h;

        if (!this.lockAspectRatio || (w === 1 && h === 1) || r === 1) {
          return { width: vec.x, height: vec.y };
        }

        if (w / h > 1) {
          vec.x *= w / h;
          return { width: vec.x, height: vec.y };
        } else {
          vec.y /= w / h;
          return { width: vec.x, height: vec.y };
        }
      },
    });

    const showBounds = this.values.get("showBounds");
    showBounds?.onChanged(() => {
      this.#updateShowBounds();
    });

    const zoom = this.values.get("zoom");
    zoom?.onChanged(() => {
      this.#debug?.redraw();
    });

    const lockAspectRatio = this.values.get("lockAspectRatio");
    lockAspectRatio?.onChanged(() => {
      this.#debug?.redraw();
    });

    const aspectRatio = this.values.get("aspectRatio");
    aspectRatio?.onChanged(() => {
      this.#debug?.redraw();
    });

    const activeValue = this.values.get("active");
    activeValue?.onChanged(() => {
      if (this.#debug) {
        this.#debug.suffix = this.active ? " (active)" : "";
      }
    });
  }

  #onSelectedSvc(svc: SelectedEntityService) {
    this.#debugListener = svc.listen(selected => {
      this.#selected = selected.includes(this);
      this.#updateShowBounds();
    });
  }
}


type _HasAllValues = EnsureCompatible<
  Omit<EntityValueProps<Camera>, "container" | "smoothed" | "frustum" | "orbit" | "focus" | "orbitDistance">,
  EntityValueProps<EditorFacadeCamera>
>;
