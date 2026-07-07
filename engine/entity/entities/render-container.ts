/**
 * RenderContainer — a grouping entity (formerly a PixiJS cached texture container).
 *
 * In the 3D engine this is a no-op pass-through group. Children render through their
 * own entity renderers. The caching/resolution/antialiasing properties are kept for
 * data compatibility but have no effect in 3D.
 *
 * TODO: Could render children to a RenderTarget and use as a texture (for post-FX).
 */
import {
  Entity,
  type EntityContext,
  enumAdapter,
} from "@rebur/engine";

type ScaleFilterMode = enumAdapter.Union<typeof ScaleFilterModeAdapter>;
const ScaleFilterModeAdapter = enumAdapter(["default", "linear", "nearest"]);

export class RenderContainer extends Entity {
  static {
    Entity.registerType(this, "@core");
  }

  static readonly icon: string = "🎨";
  readonly bounds = undefined;

  /** Kept for data compat — no effect in 3D. */
  resolution: number = 256;
  /** Kept for data compat — no effect in 3D. */
  antialiased: boolean = true;
  /** Kept for data compat — no effect in 3D. */
  scaleFilterMode: ScaleFilterMode = "default";

  constructor(ctx: EntityContext) {
    super(ctx);

    this.defineValue(RenderContainer, "resolution", {
      description: "Render resolution (data compat only — no effect in 3D).",
    });
    this.defineValue(RenderContainer, "antialiased", {
      description: "Antialiasing (data compat only — no effect in 3D).",
    });
    this.defineValue(RenderContainer, "scaleFilterMode", {
      type: ScaleFilterModeAdapter,
      description: "Scale filter (data compat only — no effect in 3D).",
    });
  }

  refresh(): void {
    // No-op in 3D
  }
}
