/**
 * BoxResizeGizmo — stub retained from the 2D editor's "Edit Dimensions" tool.
 *
 * The 2D drag-handles-around-a-rectangle interaction does not translate to 3D;
 * entity dimensions are edited through the Inspector, and transforms through
 * the 3D translate gizmo. This stub keeps the editor's selection plumbing
 * compiling; it renders nothing and handles no input.
 */
import type { EntityContext, ITransform } from "@rebur/engine";
import { Entity } from "@rebur/engine";

export class BoxResizeGizmoResizeEnd {
  constructor(
    public readonly entity: Entity,
    public readonly previous: Pick<ITransform, "position" | "scale">,
    public readonly scale: Pick<ITransform, "position" | "scale">,
  ) {}
}

export class BoxResizeGizmo extends Entity {
  static {
    Entity.registerType(this, "@editor");
  }

  static readonly icon: string = "📐";
  readonly bounds: undefined;

  target: Entity | undefined;
  auxTargets: Entity[] = [];

  constructor(ctx: EntityContext) {
    super(ctx);
  }
}
