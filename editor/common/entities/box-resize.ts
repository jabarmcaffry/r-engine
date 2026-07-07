import type { EntityContext, EntityDefinition, Transform } from "@rebur/engine";
import {
  Camera,
  Clickable,
  ColoredSquare,
  Empty,
  Entity,
  EntityDestroyed,
  GameRender,
  IVector2,
  MouseDown,
  pointLocalToWorld,
  pointWorldToLocal,
  Root,
  Vector2,
} from "@rebur/engine";
import { EditorMetadataEntity } from "../metadata.ts";
import { EditorFacadeCamera, EditorRootFacadeEntity } from "../mod.ts";
import { Gizmo, GizmoUpdateEnd } from "./gizmo.ts";
import { EmptyFacade } from "../facades/empty.ts";

export class BoxResizeGizmoResizeEnd {
  constructor(
    public readonly entity: Entity,
    public readonly previous: { position: Vector2; scale: Vector2 },
    public readonly scale: { position: Vector2; scale: Vector2 },
  ) {}
}

// TODO: implement signals

type HandleType = "corner" | "edge";
type CornerHandle = `${"t" | "b"}${"l" | "r"}`;
type EdgeHandle = "t" | "l" | "b" | "r";
type Handle = CornerHandle | EdgeHandle;

const oppositeHandle = (handle: Handle): Handle => {
  switch (handle) {
    case "t":
      return "b";
    case "b":
      return "t";
    case "l":
      return "r";
    case "r":
      return "l";
    case "tl":
      return "br";
    case "tr":
      return "bl";
    case "bl":
      return "tr";
    case "br":
      return "tl";
  }
};

const handlePos = (handle: Handle, entity: Entity): Vector2 => {
  const bounds = entity.bounds!;

  // TODO: support offset bounds
  const pos = Vector2.div({ x: bounds.width, y: bounds.height }, 2);

  switch (handle) {
    case "t": {
      pos.assign({ x: 0 });
      break;
    }
    case "b": {
      pos.assign({ x: 0, y: -pos.y });
      break;
    }
    case "l": {
      pos.assign({ x: -pos.x, y: 0 });
      break;
    }
    case "r": {
      pos.assign({ y: 0 });
      break;
    }
    case "tl": {
      pos.assign({ x: -pos.x });
      break;
    }
    // case "tr" does nothing
    case "bl": {
      pos.assign({ x: -pos.x, y: -pos.y });
      break;
    }
    case "br": {
      pos.assign({ y: -pos.y });
      break;
    }
  }

  return pointLocalToWorld(entity.globalTransform, pos);
};

// TODO: make work when rotated lol
export class BoxResizeGizmo extends Entity {
  static {
    Entity.registerType(this, "@editor");
  }

  readonly bounds: undefined;

  static readonly #STROKE_WIDTH = 5 / 100;
  static readonly #CLICK_WIDTH = BoxResizeGizmo.#STROKE_WIDTH * 2.5;
  static readonly #CORNER_WIDTH = BoxResizeGizmo.#CLICK_WIDTH * 1.25;
  static readonly #ROTATE_OFFSET = 0.25;
  static readonly #STROKE_COLOR = 0x22a2ff;

  static readonly #__DEBUG__ = false;

  /** Canvas 2D overlay used to draw the selection box + snap lines */
  #overlayCanvas: HTMLCanvasElement | undefined;
  /** Snap lines to draw this frame (in world coords), populated in #onMouseMove */
  #snapLines: { x1: number; y1: number; x2: number; y2: number; color: string }[] = [];

  #shift = this.inputs.create("@box-resize/Shift", "Shift", "ShiftLeft");

  #target: [Entity, Vector2] | undefined;
  get target(): Entity | undefined {
    return this.#target?.[0];
  }
  set target(value: Entity | undefined) {
    if (this.#target) this.#target[0].unregister(EntityDestroyed, this.#onTargetDestroyed);

    if (this.#target) {
      this.#unhighlightEntity(this.#target[0]);
    }

    this.#target = value ? [value, Vector2.ZERO] : undefined;
    this.#updateTargetOffsets();
    this.#updateHandles();

    if (this.#target && this.#auxTargets.size > 0) {
      this.#highlightEntity(this.#target[0]);
    }

    if (this.#target) this.#target[0].on(EntityDestroyed, this.#onTargetDestroyed);
  }

  #onTargetDestroyed = () => {
    this.target = undefined;
  };

  #auxTargets = new Map<Entity, Vector2>();
  /** Entity refs currently highlighted via setEntityHighlight */
  #selectionHighlights = new Set<string>();
  get auxTargets(): Entity[] {
    return [...this.#auxTargets.keys()];
  }
  set auxTargets(value: Entity[]) {
    this.#auxTargets.clear();
    this.#clearAllHighlights();

    const sorted = value.toSorted((a, b) => a.depth - b.depth);
    for (const entity of sorted) {
      this.#auxTargets.set(entity, Vector2.ZERO);
      this.#highlightEntity(entity);
    }

    if (this.#target && this.#auxTargets.size > 0) {
      this.#highlightEntity(this.#target[0]);
      this.#updateTargetOffsets();
    }

    this.#updateHandles();
  }

  #calculateAvgPosition(): Vector2 {
    if (this.#target === undefined) throw new Error("invalid average access");

    const allEntities = [this.#target[0], ...this.auxTargets];
    const sum = new Vector2(0, 0);

    for (const entity of allEntities) {
      sum.x += entity.globalTransform.position.x;
      sum.y += entity.globalTransform.position.y;
    }

    return new Vector2(sum.x / allEntities.length, sum.y / allEntities.length);
  }

  #updateTargetOffsets() {
    if (this.#target === undefined) {
      for (const vector of this.#auxTargets.values()) {
        vector.assign(Vector2.ZERO);
      }
      return;
    }

    const pos = this.#calculateAvgPosition();
    this.#target[1].assign(this.#target[0].pos.sub(pos));

    for (const [entity, offset] of this.#auxTargets) {
      offset.assign(entity.pos.sub(pos));
    }
  }

  #highlightEntity(entity: Entity) {
    if (!this.game.isClient()) return;
    if (this.#selectionHighlights.has(entity.ref)) return;
    if (!entity.bounds) return;
    this.game.renderer.setEntityHighlight(entity.ref, true, 0x22a2ff);
    this.#selectionHighlights.add(entity.ref);
  }

  #unhighlightEntity(entity: Entity) {
    if (!this.game.isClient()) return;
    if (this.#selectionHighlights.has(entity.ref)) {
      this.game.renderer.setEntityHighlight(entity.ref, false);
      this.#selectionHighlights.delete(entity.ref);
    }
  }

  #clearAllHighlights() {
    if (!this.game.isClient()) return;
    for (const ref of this.#selectionHighlights) {
      this.game.renderer.setEntityHighlight(ref, false);
    }
    this.#selectionHighlights.clear();
  }

  // #region Handles
  #calculateGripSizes(scaled: IVector2): IVector2 {
    const offset = BoxResizeGizmo.#CORNER_WIDTH / 2;
    return {
      x: scaled.x - offset,
      y: scaled.y - offset,
    };
  }

  #calculateHandlePositions(
    scaled: IVector2,
  ): Record<`${"t" | "b"}${"l" | "r"}` | "rot", IVector2> {
    const offset = BoxResizeGizmo.#CORNER_WIDTH / 1.5;
    const pos: IVector2 = {
      x: scaled.x / 2 - BoxResizeGizmo.#STROKE_WIDTH + offset,
      y: scaled.y / 2 - BoxResizeGizmo.#STROKE_WIDTH + offset,
    };

    return {
      tl: { x: -pos.x, y: pos.y },
      tr: { x: pos.x, y: pos.y },
      bl: { x: -pos.x, y: -pos.y },
      br: { x: pos.x, y: -pos.y },
      rot: { x: 0, y: scaled.y / 2 + BoxResizeGizmo.#ROTATE_OFFSET },
    };
  }

  #updateHandles() {
    // Destroy existing chilldren
    this.children.forEach(c => c.destroy());

    // Don't spawn handles if no target entity
    if (!this.#target) return;
    const entity = this.#target[0];

    const translateOnMouseDown =
      (axis: "x" | "y" | "both") =>
      ({ button, cursor: { world } }: MouseDown) => {
        if (!this.#target) return;
        if (button !== "left") return;

        const offset = world.sub(this.globalTransform.position);
        const entities = [this.#target[0], ...this.#auxTargets.keys()];
        const originals = new Map(
          entities.map(entity => [entity, entity.globalTransform.clone()] as const),
        );
        this.#action = { type: "translate", axis, offset, originals };
      };

    // Get entity bounds first
    const bounds = entity.bounds;

    // Calculate the size for the translate area based on entity bounds
    let translateWidth = 0.5;
    let translateHeight = 0.5;

    if (this.#auxTargets.size > 0) {
      // Use small box for multi-select (old behavior)
      translateWidth = 0.5;
      translateHeight = 0.5;
    } else if (bounds) {
      // Use full area for single select
      const scaled = Vector2.mul(
        { x: bounds.width, y: bounds.height },
        entity.globalTransform.scale,
      );
      translateWidth = scaled.x;
      translateHeight = scaled.y;
    } else {
      // Fallback for entities without bounds
      translateWidth = 0.3;
      translateHeight = 0.3;
    }

    const translateBoth = this.spawn({
      type: Clickable,
      name: "TranslateBoth",
      transform: { position: { x: 0, y: 0 } },
      values: {
        shape: "Rectangle",
        width: translateWidth,
        height: translateHeight,
        cursor: "move",
      },
    });

    // Override cursor dynamically - don't show move cursor when dragging
    translateBoth.getCursor = () => {
      return this.#action ? "" : "move";
    };

    translateBoth.on(MouseDown, translateOnMouseDown("both"));

    // Don't spawn handles for entities with offset bounds
    if (!bounds) return;
    if (bounds.offset && (bounds.offset.x !== 0 || bounds.offset.y !== 0)) return;
    if (this.#auxTargets.size > 0) return;

    // TODO: support offset bounds
    const scaled = Vector2.mul(
      { x: bounds.width, y: bounds.height },
      entity.globalTransform.scale,
    );

    const container = this.spawn({ type: Empty, name: "Container" });

    const __debug__ = (color: string, ...clickables: Clickable[]) => {
      if (!BoxResizeGizmo.#__DEBUG__) return;
      for (const clickable of clickables) {
        const width = clickable.width;
        const height = clickable.height;

        clickable.spawn({
          type: ColoredSquare,
          name: "__DEBUG__",
          transform: { z: Number.MAX_SAFE_INTEGER },
          values: { width, height, color },
        });
      }
    };

    const grip = this.#calculateGripSizes(scaled);

    const leftEdge = container.spawn({
      type: Clickable,
      name: "LeftEdge",
      transform: {
        z: 999_999,
        position: { x: -(scaled.x / 2 + BoxResizeGizmo.#CLICK_WIDTH / 2), y: 0 },
      },
      values: {
        shape: "Rectangle",
        width: BoxResizeGizmo.#CLICK_WIDTH,
        height: grip.y,
        cursor: "pointer",
      },
    });

    const rightEdge = container.spawn({
      type: Clickable,
      name: "RightEdge",
      transform: {
        z: 999_999,
        position: { x: scaled.x / 2 + BoxResizeGizmo.#CLICK_WIDTH / 2, y: 0 },
      },
      values: {
        shape: "Rectangle",
        width: BoxResizeGizmo.#CLICK_WIDTH,
        height: grip.y,
        cursor: "pointer",
      },
    });

    const topEdge = container.spawn({
      type: Clickable,
      name: "TopEdge",
      transform: {
        z: 999_999,
        position: { x: 0, y: scaled.y / 2 + BoxResizeGizmo.#CLICK_WIDTH / 2 },
      },
      values: {
        shape: "Rectangle",
        width: grip.x,
        height: BoxResizeGizmo.#CLICK_WIDTH,
        cursor: "pointer",
      },
    });

    const bottomEdge = container.spawn({
      type: Clickable,
      name: "BottomEdge",
      transform: {
        z: 999_999,
        position: { x: 0, y: -(scaled.y / 2 + BoxResizeGizmo.#CLICK_WIDTH / 2) },
      },
      values: {
        shape: "Rectangle",
        width: grip.x,
        height: BoxResizeGizmo.#CLICK_WIDTH,
        cursor: "pointer",
      },
    });

    const handles = this.#calculateHandlePositions(scaled);
    const handleValues = {
      shape: "Rectangle",
      width: BoxResizeGizmo.#CORNER_WIDTH * 1.2,
      height: BoxResizeGizmo.#CORNER_WIDTH * 1.2,
    } satisfies EntityDefinition<Clickable>["values"];

    const topLeft = container.spawn({
      type: Clickable,
      name: "TopLeft",
      transform: {
        z: 1_000_000,
        position: handles.tl,
      },
      values: { ...handleValues, cursor: "pointer" },
    });

    const topRight = container.spawn({
      type: Clickable,
      name: "TopRight",
      transform: {
        z: 1_000_000,
        position: handles.tr,
      },
      values: { ...handleValues, cursor: "pointer" },
    });

    const bottomLeft = container.spawn({
      type: Clickable,
      name: "BottomLeft",
      transform: {
        z: 1_000_000,
        position: handles.bl,
      },
      values: { ...handleValues, cursor: "pointer" },
    });

    const bottomRight = container.spawn({
      type: Clickable,
      name: "BottomRight",
      transform: {
        z: 1_000_000,
        position: handles.br,
      },
      values: { ...handleValues, cursor: "pointer" },
    });

    const rotate = container.spawn({
      type: Clickable,
      name: "Rotate",
      transform: {
        z: 1_000_000,
        position: handles.rot,
      },
      values: { ...handleValues, cursor: "pointer" },
    });

    rotate.on(MouseDown, ({ button }) => {
      if (!this.#target) return;
      if (button !== "left") return;

      const entities = [this.#target[0], ...this.#auxTargets.keys()];
      const originals = new Map(
        entities.map(entity => [entity, entity.globalTransform.clone()] as const),
      );
      this.#action = { type: "rotate", originals };
    });

    const onMouseDown =
      (handle: Handle, handleType: HandleType) =>
      ({ button }: MouseDown) => {
        if (!this.#target) return;
        if (button !== "left") return;

        const opposite = handlePos(oppositeHandle(handle), this.#target[0]);
        const entities = [this.#target[0], ...this.#auxTargets.keys()];
        const originals = new Map(
          entities.map(entity => [entity, entity.globalTransform.clone()] as const),
        );
        this.#action = {
          type: "scale",
          handle,
          handleType,
          opposite,
          originals,
        };
      };

    leftEdge.on(MouseDown, onMouseDown("l", "edge"));
    rightEdge.on(MouseDown, onMouseDown("r", "edge"));
    topEdge.on(MouseDown, onMouseDown("t", "edge"));
    bottomEdge.on(MouseDown, onMouseDown("b", "edge"));
    topLeft.on(MouseDown, onMouseDown("tl", "corner"));
    topRight.on(MouseDown, onMouseDown("tr", "corner"));
    bottomLeft.on(MouseDown, onMouseDown("bl", "corner"));
    bottomRight.on(MouseDown, onMouseDown("br", "corner"));

    __debug__("#ff0000af", leftEdge, rightEdge, topEdge, bottomEdge);
    __debug__("#00ff00af", topLeft, topRight, bottomLeft, bottomRight);
    __debug__("#ff00ffaf", rotate);
  }

  #updateHandlePositions(camera: Camera) {
    // We dont want the handle sizes to change with scale

    if (!this.#target) return;
    const entity = this.#target[0];
    const bounds = entity.bounds;
    if (!bounds) return;
    if (bounds.offset && (bounds.offset.x !== 0 || bounds.offset.y !== 0)) return;

    // TODO: support offset bounds
    const cameraScale = new Vector2(camera.zoom, camera.zoom);
    const scaled = Vector2.div(
      Vector2.mul({ x: bounds.width, y: bounds.height }, entity.globalTransform.scale),
      cameraScale,
    );

    const container = this.children.get("Container")?.cast(Empty);
    if (container) container.globalTransform.rotation = entity.globalTransform.rotation;

    const __debug__ = (...clickables: (Clickable | undefined)[]) => {
      if (!BoxResizeGizmo.#__DEBUG__) return;
      for (const clickable of clickables) {
        if (!clickable) continue;
        const debug = clickable?.children.get("__DEBUG__") as
          | { width: number; height: number }
          | undefined;

        if (!debug) continue;
        debug.width = clickable.width;
        debug.height = clickable.height;
      }
    };

    const grip = this.#calculateGripSizes(scaled);
    const handles = this.#calculateHandlePositions(scaled);

    // Update the translate area size
    const translateBoth = this.children.get("TranslateBoth")?.cast(Clickable);
    if (translateBoth) {
      if (this.#auxTargets.size > 0) {
        // Use small box for multi-select (old behavior)
        translateBoth.width = 0.5;
        translateBoth.height = 0.5;
      } else {
        // Use full area for single select
        translateBoth.width = scaled.x;
        translateBoth.height = scaled.y;
      }
    }

    const leftEdge = container?.children.get("LeftEdge")?.cast(Clickable);
    if (leftEdge) {
      leftEdge.height = grip.y;
      leftEdge.transform.position.x = -(scaled.x / 2 + BoxResizeGizmo.#CLICK_WIDTH / 2);
    }

    const rightEdge = container?.children.get("RightEdge")?.cast(Clickable);
    if (rightEdge) {
      rightEdge.height = grip.y;
      rightEdge.transform.position.x = scaled.x / 2 + BoxResizeGizmo.#CLICK_WIDTH / 2;
    }

    const topEdge = container?.children.get("TopEdge")?.cast(Clickable);
    if (topEdge) {
      topEdge.width = grip.x;
      topEdge.transform.position.y = scaled.y / 2 + BoxResizeGizmo.#CLICK_WIDTH / 2;
    }

    const bottomEdge = container?.children.get("BottomEdge")?.cast(Clickable);
    if (bottomEdge) {
      bottomEdge.width = grip.x;
      bottomEdge.transform.position.y = -(scaled.y / 2 + BoxResizeGizmo.#CLICK_WIDTH / 2);
    }

    const topLeft = container?.children.get("TopLeft")?.cast(Clickable);
    if (topLeft) topLeft.transform.position.assign(handles.tl);

    const topRight = container?.children.get("TopRight")?.cast(Clickable);
    if (topRight) topRight.transform.position.assign(handles.tr);

    const bottomLeft = container?.children.get("BottomLeft")?.cast(Clickable);
    if (bottomLeft) bottomLeft.transform.position.assign(handles.bl);

    const bottomRight = container?.children.get("BottomRight")?.cast(Clickable);
    if (bottomRight) bottomRight.transform.position.assign(handles.br);

    const rotate = container?.children.get("Rotate")?.cast(Clickable);
    if (rotate) rotate.transform.position.assign(handles.rot);

    __debug__(
      leftEdge,
      rightEdge,
      topEdge,
      bottomEdge,
      topLeft,
      topRight,
      bottomLeft,
      bottomRight,
    );
  }
  // #endregion

  // #region Action / Signals
  #action:
    | {
        type: "translate";
        axis: "x" | "y" | "both";
        offset: Vector2;
        originals: Map<Entity, Transform>;
      }
    | { type: "rotate"; originals: Map<Entity, Transform> }
    | {
        type: "scale";
        handle: Handle;
        handleType: HandleType;
        opposite: Vector2;
        originals: Map<Entity, Transform>;
      }
    | undefined;

  #onMouseMove = (event: PointerEvent) => {
    this.#snapLines = [];
    if (!this.#target) return;
    if (!this.#action) return;

    const cursor = this.inputs.cursor;
    if (!cursor.world) return;

    if (this.#action.type === "rotate") {
      const rotationCenter =
        this.#auxTargets.size > 0
          ? this.#calculateAvgPosition()
          : this.#target[0].globalTransform.position;
      let angle = Vector2.lookAt(rotationCenter, cursor.world);
      if (this.#shift.held) {
        const snap = Math.PI / 8;
        angle = Math.round(angle / snap) * snap;
      }

      if (this.#auxTargets.size > 0) {
        const entities = [this.#target[0], ...this.#auxTargets.keys()];
        for (const entity of entities) {
          const original = this.#action.originals.get(entity)!;
          const deltaRot = angle - original.rotation;

          entity.globalTransform.position = Vector2.rotateAbout(
            original.position,
            deltaRot,
            rotationCenter,
          );
          entity.globalTransform.rotation = angle;
        }
        this.#updateTargetOffsets();
      } else {
        this.#target[0].globalTransform.rotation = angle;
      }
      return;
    }

    if (this.#action.type === "translate") {
      const pos = cursor.world.sub(this.#action.offset);

      const local = pointWorldToLocal(this.globalTransform, pos);
      if (this.#action.axis === "x") local.y = 0;
      if (this.#action.axis === "y") local.x = 0;
      const world = pointLocalToWorld(this.globalTransform, local);

      if (event.shiftKey) {
        const snapThreshold = 0.1;

        const allSelectedEntities = [this.#target[0], ...this.#auxTargets.keys()];

        const originalPositions = new Map(
          allSelectedEntities.map(entity => [entity, entity.globalTransform.position.clone()]),
        );

        // Temporarily move all entities to tentative position
        this.#target[0].globalTransform.position = world.add(this.#target[1]);
        for (const [entity, offset] of this.#auxTargets) {
          entity.globalTransform.position = world.add(offset);
        }

        let targetCorners = Gizmo.getTransformedCorners(this.#target[0]);
        let targetBounds = Gizmo.computeGlobalBounds(this.#target[0]);

        if (allSelectedEntities.length > 1) {
          // aabb if we have multiselect
          targetBounds = Gizmo.computeAABBForEntities(allSelectedEntities);
          targetCorners = Gizmo.getAABBCorners(targetBounds);
        }

        const targetCenter = {
          x: (targetBounds.minX + targetBounds.maxX) / 2,
          y: (targetBounds.minY + targetBounds.maxY) / 2,
        };

        for (const [entity, originalPos] of originalPositions) {
          entity.globalTransform.position = originalPos;
        }

        let snapX: number | undefined;
        let snapY: number | undefined;
        let bestSnapDistanceX = snapThreshold;
        let bestSnapDistanceY = snapThreshold;
        let bestXSnapInfo:
          | { line: number; minY: number; maxY: number; color: number }
          | undefined;
        let bestYSnapInfo:
          | { line: number; minX: number; maxX: number; color: number }
          | undefined;

        for (const e of this.game.entities) {
          if (allSelectedEntities.includes(e)) continue;
          if (allSelectedEntities.some(selected => e.parent === selected)) continue;
          if (!e.enabled) continue;
          if (e instanceof Root) continue;
          if (e instanceof Gizmo || e.parent instanceof Gizmo) continue;
          if (
            e instanceof BoxResizeGizmo ||
            e.parent instanceof BoxResizeGizmo ||
            e.parent?.parent instanceof BoxResizeGizmo
          )
            continue;
          if (e instanceof Camera || e instanceof EditorFacadeCamera) continue;
          if (e instanceof EditorRootFacadeEntity) continue;
          if (e instanceof EditorMetadataEntity) continue;
          if (e instanceof EmptyFacade) continue;
          if (e.ref === "EDIT_ROOT") continue;

          const entityBounds = Gizmo.computeGlobalBounds(e);
          const entityCorners = Gizmo.getTransformedCorners(e);
          const entityCenter = {
            x: (entityBounds.minX + entityBounds.maxX) / 2,
            y: (entityBounds.minY + entityBounds.maxY) / 2,
          };

          // Corner-to-corner snapping (like Figma)
          for (const targetCorner of targetCorners) {
            for (const entityCorner of entityCorners) {
              const dx = entityCorner.x - targetCorner.x;
              const dy = entityCorner.y - targetCorner.y;

              // Check X alignment
              if (Math.abs(dx) < bestSnapDistanceX && dx !== 0) {
                snapX = world.x + dx;
                bestSnapDistanceX = Math.abs(dx);

                const minY = Math.min(
                  targetBounds.minY,
                  targetBounds.maxY,
                  entityBounds.minY,
                  entityBounds.maxY,
                );
                const maxY = Math.max(
                  targetBounds.minY,
                  targetBounds.maxY,
                  entityBounds.minY,
                  entityBounds.maxY,
                );

                bestXSnapInfo = { line: entityCorner.x, minY, maxY, color: 0xff6b9d };
              }

              // Check Y alignment
              if (Math.abs(dy) < bestSnapDistanceY && dy !== 0) {
                snapY = world.y + dy;
                bestSnapDistanceY = Math.abs(dy);

                const minX = Math.min(
                  targetBounds.minX,
                  targetBounds.maxX,
                  entityBounds.minX,
                  entityBounds.maxX,
                );
                const maxX = Math.max(
                  targetBounds.minX,
                  targetBounds.maxX,
                  entityBounds.minX,
                  entityBounds.maxX,
                );

                bestYSnapInfo = { line: entityCorner.y, minX, maxX, color: 0xff6b9d };
              }
            }
          }

          // Corner-to-center snapping
          for (const targetCorner of targetCorners) {
            const dx = entityCenter.x - targetCorner.x;
            const dy = entityCenter.y - targetCorner.y;

            // Check X alignment
            if (Math.abs(dx) < bestSnapDistanceX && dx !== 0) {
              snapX = world.x + dx;
              bestSnapDistanceX = Math.abs(dx);

              const minY = Math.min(entityBounds.minY, targetBounds.minY);
              const maxY = Math.max(entityBounds.maxY, targetBounds.maxY);

              bestXSnapInfo = { line: entityCenter.x, minY, maxY, color: 0xffb366 };
            }

            // Check Y alignment
            if (Math.abs(dy) < bestSnapDistanceY && dy !== 0) {
              snapY = world.y + dy;
              bestSnapDistanceY = Math.abs(dy);

              const minX = Math.min(entityBounds.minX, targetBounds.minX);
              const maxX = Math.max(entityBounds.maxX, targetBounds.maxX);

              bestYSnapInfo = { line: entityCenter.y, minX, maxX, color: 0xffb366 };
            }
          }

          // Center-to-corner snapping
          for (const entityCorner of entityCorners) {
            const dx = entityCorner.x - targetCenter.x;
            const dy = entityCorner.y - targetCenter.y;

            // Check X alignment
            if (Math.abs(dx) < bestSnapDistanceX && dx !== 0) {
              snapX = world.x + dx;
              bestSnapDistanceX = Math.abs(dx);

              const minY = Math.min(entityBounds.minY, targetBounds.minY);
              const maxY = Math.max(entityBounds.maxY, targetBounds.maxY);

              bestXSnapInfo = { line: entityCorner.x, minY, maxY, color: 0x66d9ff };
            }

            // Check Y alignment
            if (Math.abs(dy) < bestSnapDistanceY && dy !== 0) {
              snapY = world.y + dy;
              bestSnapDistanceY = Math.abs(dy);

              const minX = Math.min(entityBounds.minX, targetBounds.minX);
              const maxX = Math.max(entityBounds.maxX, targetBounds.maxX);

              bestYSnapInfo = { line: entityCorner.y, minX, maxX, color: 0x66d9ff };
            }
          }

          // Edge-to-edge snapping (existing behavior, but cleaner)
          const edgeAlignments = [
            // Horizontal alignments
            { delta: entityBounds.minX - targetBounds.minX, line: entityBounds.minX }, // left-to-left
            { delta: entityBounds.maxX - targetBounds.maxX, line: entityBounds.maxX }, // right-to-right
            { delta: entityBounds.minX - targetBounds.maxX, line: entityBounds.minX }, // right-to-left
            { delta: entityBounds.maxX - targetBounds.minX, line: entityBounds.maxX }, // left-to-right
          ];

          for (const alignment of edgeAlignments) {
            if (Math.abs(alignment.delta) < bestSnapDistanceX && alignment.delta !== 0) {
              snapX = world.x + alignment.delta;
              bestSnapDistanceX = Math.abs(alignment.delta);

              const minY = Math.min(entityBounds.minY, targetBounds.minY);
              const maxY = Math.max(entityBounds.maxY, targetBounds.maxY);

              bestXSnapInfo = { line: alignment.line, minY, maxY, color: 0xabddff };
            }
          }

          const verticalAlignments = [
            // Vertical alignments
            { delta: entityBounds.minY - targetBounds.minY, line: entityBounds.minY }, // top-to-top
            { delta: entityBounds.maxY - targetBounds.maxY, line: entityBounds.maxY }, // bottom-to-bottom
            { delta: entityBounds.minY - targetBounds.maxY, line: entityBounds.minY }, // bottom-to-top
            { delta: entityBounds.maxY - targetBounds.minY, line: entityBounds.maxY }, // top-to-bottom
          ];

          for (const alignment of verticalAlignments) {
            if (Math.abs(alignment.delta) < bestSnapDistanceY && alignment.delta !== 0) {
              snapY = world.y + alignment.delta;
              bestSnapDistanceY = Math.abs(alignment.delta);

              const minX = Math.min(entityBounds.minX, targetBounds.minX);
              const maxX = Math.max(entityBounds.maxX, targetBounds.maxX);

              bestYSnapInfo = { line: alignment.line, minX, maxX, color: 0xabddff };
            }
          }

          // Center-to-center snapping
          const dxCenter = entityCenter.x - targetCenter.x;
          const dyCenter = entityCenter.y - targetCenter.y;

          if (Math.abs(dxCenter) < bestSnapDistanceX && dxCenter !== 0) {
            snapX = world.x + dxCenter;
            bestSnapDistanceX = Math.abs(dxCenter);

            const minY = Math.min(entityBounds.minY, targetBounds.minY);
            const maxY = Math.max(entityBounds.maxY, targetBounds.maxY);

            bestXSnapInfo = { line: entityCenter.x, minY, maxY, color: 0x9d6bff };
          }

          if (Math.abs(dyCenter) < bestSnapDistanceY && dyCenter !== 0) {
            snapY = world.y + dyCenter;
            bestSnapDistanceY = Math.abs(dyCenter);

            const minX = Math.min(entityBounds.minX, targetBounds.minX);
            const maxX = Math.max(entityBounds.maxX, targetBounds.maxX);

            bestYSnapInfo = { line: entityCenter.y, minX, maxX, color: 0x9d6bff };
          }
        }

        // Draw only the best snap candidates
        const toHex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;
        if (bestXSnapInfo) {
          this.#snapLines.push({
            x1: bestXSnapInfo.line, y1: bestXSnapInfo.minY,
            x2: bestXSnapInfo.line, y2: bestXSnapInfo.maxY,
            color: toHex(bestXSnapInfo.color),
          });
        }
        if (bestYSnapInfo) {
          this.#snapLines.push({
            x1: bestYSnapInfo.minX, y1: bestYSnapInfo.line,
            x2: bestYSnapInfo.maxX, y2: bestYSnapInfo.line,
            color: toHex(bestYSnapInfo.color),
          });
        }

        // Apply any snap adjustments
        if (snapX !== undefined) world.x = snapX;
        if (snapY !== undefined) world.y = snapY;
      }

      if (this.#auxTargets.size > 0) {
        this.#target[0].globalTransform.position = world.add(this.#target[1]);
        for (const [entity, offset] of this.#auxTargets) {
          entity.globalTransform.position = world.add(offset);
        }
      } else {
        this.#target[0].globalTransform.position = world;
      }

      return;
    }

    const handle = this.#action.handle;
    const lockedAxis: "x" | "y" | undefined =
      handle === "t" || handle === "b"
        ? "x"
        : handle === "l" || handle === "r"
          ? "y"
          : undefined;

    const rotation = this.#target[0].globalTransform.rotation;
    let adjustedCursor = cursor.world;

    // Check for snapping when shift is held
    if (event.shiftKey) {
      const snapThreshold = 0.1;
      const targetEntity = this.#target[0];

      let bestSnapDistance = snapThreshold;
      let bestSnapInfo:
        | { line: number; minCoord: number; maxCoord: number; color: number }
        | undefined;
      let snapTarget: number | undefined;

      for (const e of this.game.entities) {
        if (e === targetEntity) continue;
        if (!e.enabled) continue;
        if (e instanceof Root) continue;
        if (e instanceof Gizmo || e.parent instanceof Gizmo) continue;
        if (
          e instanceof BoxResizeGizmo ||
          e.parent instanceof BoxResizeGizmo ||
          e.parent?.parent instanceof BoxResizeGizmo
        )
          continue;
        if (e instanceof Camera || e instanceof EditorFacadeCamera) continue;
        if (e instanceof EditorRootFacadeEntity) continue;
        if (e instanceof EditorMetadataEntity) continue;
        if (e instanceof EmptyFacade) continue;
        if (e.ref === "EDIT_ROOT") continue;

        const entityBounds = Gizmo.computeGlobalBounds(e);
        const entityCorners = Gizmo.getTransformedCorners(e);

        if (lockedAxis === "x") {
          // Resizing vertically (top/bottom edge), snap to horizontal lines
          const snapCandidates = [
            { pos: entityBounds.minY, type: "edge" },
            { pos: entityBounds.maxY, type: "edge" },
            ...entityCorners.map(corner => ({ pos: corner.y, type: "corner" })),
          ];

          for (const candidate of snapCandidates) {
            const distance = Math.abs(candidate.pos - cursor.world.y);
            if (distance < bestSnapDistance) {
              snapTarget = candidate.pos;
              bestSnapDistance = distance;

              const targetBounds = Gizmo.computeGlobalBounds(targetEntity);
              const minX = Math.min(entityBounds.minX, targetBounds.minX);
              const maxX = Math.max(entityBounds.maxX, targetBounds.maxX);
              const color = candidate.type === "edge" ? 0xabddff : 0xff6b9d;

              bestSnapInfo = { line: candidate.pos, minCoord: minX, maxCoord: maxX, color };
            }
          }
        } else if (lockedAxis === "y") {
          // Resizing horizontally (left/right edge), snap to vertical lines
          const snapCandidates = [
            { pos: entityBounds.minX, type: "edge" },
            { pos: entityBounds.maxX, type: "edge" },
            ...entityCorners.map(corner => ({ pos: corner.x, type: "corner" })),
          ];

          for (const candidate of snapCandidates) {
            const distance = Math.abs(candidate.pos - cursor.world.x);
            if (distance < bestSnapDistance) {
              snapTarget = candidate.pos;
              bestSnapDistance = distance;

              const targetBounds = Gizmo.computeGlobalBounds(targetEntity);
              const minY = Math.min(entityBounds.minY, targetBounds.minY);
              const maxY = Math.max(entityBounds.maxY, targetBounds.maxY);
              const color = candidate.type === "edge" ? 0xabddff : 0xff6b9d;

              bestSnapInfo = { line: candidate.pos, minCoord: minY, maxCoord: maxY, color };
            }
          }
        }
      }

      // Apply snap and draw line if we found one
      if (snapTarget !== undefined && bestSnapInfo) {
        const toHex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;
        if (lockedAxis === "x") {
          adjustedCursor = new Vector2(cursor.world.x, snapTarget);
          this.#snapLines.push({
            x1: bestSnapInfo.minCoord, y1: bestSnapInfo.line,
            x2: bestSnapInfo.maxCoord, y2: bestSnapInfo.line,
            color: toHex(bestSnapInfo.color),
          });
        } else if (lockedAxis === "y") {
          adjustedCursor = new Vector2(snapTarget, cursor.world.y);
          this.#snapLines.push({
            x1: bestSnapInfo.line, y1: bestSnapInfo.minCoord,
            x2: bestSnapInfo.line, y2: bestSnapInfo.maxCoord,
            color: toHex(bestSnapInfo.color),
          });
        }
      }
    }

    const rotated = Vector2.rotateAbout(adjustedCursor, -rotation, this.#action.opposite);

    const edge = Vector2.sub(rotated, this.#action.opposite);
    if (lockedAxis === "x") edge.x = this.#target[0].globalTransform.scale.x;
    if (lockedAxis === "y") edge.y = this.#target[0].globalTransform.scale.y;

    this.#target[0].globalTransform.scale.assign(Vector2.abs(edge));

    const newOrigin = Vector2.ZERO;
    if (this.#action.handleType === "corner") {
      newOrigin.assign(Vector2.add(this.#action.opposite, Vector2.div(edge, 2)));
    } else {
      const x = Vector2.div(edge, 2);
      if (lockedAxis === "x") x.x = 0;
      if (lockedAxis === "y") x.y = 0;

      newOrigin.assign(Vector2.add(this.#action.opposite, x));
    }

    this.#target[0].pos.assign(Vector2.rotateAbout(newOrigin, rotation, this.#action.opposite));
  };

  #onMouseUp = (_: PointerEvent) => {
    if (!this.#action) return;
    if (!this.#target) {
      console.warn("mouse released without target, events will not fire");
      this.#action = undefined;
      return;
    }

    const entityArray = [this.#target[0], ...this.#auxTargets.keys()];
    const entities = entityArray.map(entity => ({
      entity,
      transform: entity.globalTransform.clone(),
      previous: this.#action!.originals.get(entity)!,
    }));

    const signal = [GizmoUpdateEnd, this.#action!.type, entities] as const;
    this.fire(...signal);
    this.game.fire(...signal);

    this.#action = undefined;
  };
  // #endregion

  constructor(ctx: EntityContext) {
    super(ctx);

    // Must be a local entity
    if (ctx.parent !== this.game.local || !this.game.isClient()) {
      throw new Error(`${this.constructor.name} must be spawned as a local client entity`);
    }

    this.listen(this.game, GameRender, () => {
      const overlay = this.#overlayCanvas;
      if (!overlay) return;

      // Keep overlay canvas size in sync with the Three.js canvas
      const rendererCanvas = this.game.renderer.canvas;
      const cw = Math.max(1, rendererCanvas.clientWidth);
      const ch = Math.max(1, rendererCanvas.clientHeight);
      if (overlay.width !== cw || overlay.height !== ch) {
        overlay.width = cw;
        overlay.height = ch;
      }

      const ctx = overlay.getContext("2d")!;
      ctx.clearRect(0, 0, cw, ch);

      const camera = Camera.getActive(this.game);
      if (!camera) return;

      // Update gizmo transform so handle position math stays correct
      const cameraScale = new Vector2(camera.zoom, camera.zoom);
      this.globalTransform.scale = cameraScale;

      if (!this.#target) return;
      const entity = this.#target[0];

      if (this.#auxTargets.size > 0) {
        this.globalTransform.position = this.#calculateAvgPosition();
      } else {
        this.globalTransform.position = entity.pos;
      }
      this.globalTransform.rotation = entity.globalTransform.rotation;

      // Helper: project world XY to screen pixels
      const project = (wx: number, wy: number) =>
        this.game.renderer.worldToScreen({ x: wx, y: wy, z: 0 });

      // Draw accumulated snap lines (populated in #onMouseMove)
      for (const line of this.#snapLines) {
        const p1 = project(line.x1, line.y1);
        const p2 = project(line.x2, line.y2);
        if (!p1 || !p2) continue;
        ctx.save();
        ctx.strokeStyle = line.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.restore();
      }

      const _bounds = entity.bounds;
      const entityPos = entity.globalTransform.position;

      // No-bounds or offset-bounds: draw a small indicator square
      if (!_bounds || (_bounds.offset && (_bounds.offset.x !== 0 || _bounds.offset.y !== 0))) {
        const center = project(entityPos.x, entityPos.y);
        if (center) {
          ctx.fillStyle = "rgba(34, 255, 136, 0.3)";
          ctx.strokeStyle = "rgba(34, 255, 136, 0.8)";
          ctx.lineWidth = 2;
          ctx.fillRect(center.x - 12, center.y - 12, 24, 24);
          ctx.strokeRect(center.x - 12, center.y - 12, 24, 24);
        }
        return;
      }

      // Multi-select: draw a small indicator at average position
      if (this.#auxTargets.size > 0) {
        const avgPos = this.#calculateAvgPosition();
        const center = project(avgPos.x, avgPos.y);
        if (center) {
          ctx.fillStyle = "rgba(34, 255, 136, 0.3)";
          ctx.strokeStyle = "rgba(34, 255, 136, 0.8)";
          ctx.lineWidth = 2;
          ctx.fillRect(center.x - 12, center.y - 12, 24, 24);
          ctx.strokeRect(center.x - 12, center.y - 12, 24, 24);
        }
        return;
      }

      this.#updateHandlePositions(camera);

      // Project rotated bounding-box corners to screen space
      const entityRot = entity.globalTransform.rotation;
      const entityScale = entity.globalTransform.scale;
      const hw = (_bounds.width * entityScale.x) / 2;
      const hh = (_bounds.height * entityScale.y) / 2;
      const cos = Math.cos(entityRot);
      const sin = Math.sin(entityRot);
      const rotCorner = (lx: number, ly: number) => ({
        x: entityPos.x + lx * cos - ly * sin,
        y: entityPos.y + lx * sin + ly * cos,
      });

      const tl = project(rotCorner(-hw, hh).x, rotCorner(-hw, hh).y);
      const tr = project(rotCorner(hw, hh).x, rotCorner(hw, hh).y);
      const br = project(rotCorner(hw, -hh).x, rotCorner(hw, -hh).y);
      const bl = project(rotCorner(-hw, -hh).x, rotCorner(-hw, -hh).y);
      if (!tl || !tr || !br || !bl) return;

      // Bounding box outline
      ctx.strokeStyle = "#22a2ff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tl.x, tl.y);
      ctx.lineTo(tr.x, tr.y);
      ctx.lineTo(br.x, br.y);
      ctx.lineTo(bl.x, bl.y);
      ctx.closePath();
      ctx.stroke();

      // Corner resize handles (white squares)
      const HANDLE = 8;
      ctx.fillStyle = "white";
      ctx.strokeStyle = "#22a2ff";
      ctx.lineWidth = 1.5;
      for (const corner of [tl, tr, bl, br]) {
        ctx.fillRect(corner.x - HANDLE / 2, corner.y - HANDLE / 2, HANDLE, HANDLE);
        ctx.strokeRect(corner.x - HANDLE / 2, corner.y - HANDLE / 2, HANDLE, HANDLE);
      }

      // Rotate handle: line + circle above top-center
      const topMidX = (tl.x + tr.x) / 2;
      const topMidY = (tl.y + tr.y) / 2;
      const rotHandleX = topMidX;
      const rotHandleY = topMidY - 20;
      ctx.strokeStyle = "#22a2ff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(topMidX, topMidY);
      ctx.lineTo(rotHandleX, rotHandleY);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(rotHandleX, rotHandleY, 5, 0, Math.PI * 2);
      ctx.fillStyle = "white";
      ctx.fill();
      ctx.strokeStyle = "#22a2ff";
      ctx.stroke();
    });

    this.on(EntityDestroyed, () => {
      this.#overlayCanvas?.remove();
      this.#overlayCanvas = undefined;
      this.#clearAllHighlights();

      if (this.game.isClient()) {
        const canvas = this.game.renderer.canvas;
        canvas.removeEventListener("pointermove", this.#onMouseMove);
        canvas.removeEventListener("pointerup", this.#onMouseUp);
      }
    });
  }

  override onInitialize(): void {
    if (!this.game.isClient()) return;

    // Create a 2D canvas overlay on top of the Three.js WebGL canvas
    const overlay = document.createElement("canvas");
    overlay.style.cssText =
      "position:absolute;top:0;left:0;pointer-events:none;z-index:10;";
    const rendererCanvas = this.game.renderer.canvas;
    overlay.width = Math.max(1, rendererCanvas.clientWidth);
    overlay.height = Math.max(1, rendererCanvas.clientHeight);
    rendererCanvas.parentElement?.appendChild(overlay);
    this.#overlayCanvas = overlay;

    this.#updateHandles();

    const canvas = this.game.renderer.canvas;
    canvas.addEventListener("pointermove", this.#onMouseMove);
    canvas.addEventListener("pointerup", this.#onMouseUp);
  }
}
