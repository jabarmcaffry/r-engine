/**
 * SolidColor — a colored plane in 3D space.
 * @deprecated Use ColoredSquare instead.
 */
import {
  Entity,
  EntitySpawned,
  EntityDestroyed,
  EntityEnableChanged,
  type EntityContext,
  ColorAdapter,
  type IBounds,
  Bounds,
} from "@rebur/engine";
import type { MeshHandle, GeometryDesc, MaterialDesc } from "../../renderer/api.ts";

/** @deprecated Use ColoredSquare instead. */
export class SolidColor extends Entity {
  static {
    Entity.registerType(this, "@core");
  }

  static readonly icon = "🟪";

  width: number = 1;
  height: number = 1;
  color: string = "white";

  #meshHandle: MeshHandle | undefined;

  get bounds(): IBounds | undefined {
    return new Bounds(this.width, this.height);
  }

  constructor(ctx: EntityContext) {
    super(ctx);

    this.defineValues(SolidColor, "width", "height");
    this.defineValue(SolidColor, "color", { type: ColorAdapter });

    this.on(EntitySpawned, () => {
      const game = this.game;
      if (!game.isClient()) return;
      this.#meshHandle = game.renderer.createMesh(
        this.ref,
        this.#buildGeometry(),
        this.#buildMaterial(),
      );
      this.#syncTransform();
    });

    this.on(EntityDestroyed, () => {
      if (!this.game.isClient() || this.#meshHandle === undefined) return;
      this.game.renderer.destroyMesh(this.#meshHandle);
    });

    this.on(EntityEnableChanged, ({ enabled }) => {
      if (!this.game.isClient() || this.#meshHandle === undefined) return;
      this.game.renderer.setMeshVisible(this.#meshHandle, enabled);
    });
  }

  #buildGeometry(): GeometryDesc {
    return { type: "plane", width: this.width, height: this.height };
  }

  #buildMaterial(): MaterialDesc {
    return { type: "unlit", color: this.color, side: "double" };
  }

  #syncTransform(): void {
    if (!this.game.isClient() || this.#meshHandle === undefined) return;
    const t = this.globalTransform;
    this.game.renderer.setMeshTransform(this.#meshHandle, t.position, t.rotation, t.scale);
  }

  onFrame(): void {
    if (!this.game.isClient() || this.#meshHandle === undefined) return;
    this.#syncTransform();
    this.game.renderer.updateMeshGeometry(this.#meshHandle, this.#buildGeometry());
    this.game.renderer.updateMeshMaterial(this.#meshHandle, this.#buildMaterial());
  }
}
