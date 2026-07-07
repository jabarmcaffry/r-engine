import {
  Entity,
  EntitySpawned,
  EntityDestroyed,
  EntityEnableChanged,
  type EntityContext,
} from "@rebur/engine";
import type { MeshHandle, GeometryDesc, MaterialDesc } from "../../renderer/api.ts";

export class Mesh extends Entity {
  static {
    Entity.registerType(this, "@core");
  }

  static readonly icon = "🧊";

  // Geometry
  geometryType: GeometryDesc["type"] = "box";
  boxWidth: number = 1;
  boxHeight: number = 1;
  boxDepth: number = 1;
  sphereRadius: number = 0.5;

  // Material
  color: number = 0xffffff;
  roughness: number = 0.8;
  metalness: number = 0;
  texture: string = "";
  wireframe: boolean = false;
  castShadow: boolean = true;
  receiveShadow: boolean = true;

  #meshHandle: MeshHandle | undefined;

  get bounds() { return undefined; }

  constructor(ctx: EntityContext) {
    super(ctx);

    this.defineValue(Mesh, "geometryType", { description: "Geometry shape type." });
    this.defineValue(Mesh, "boxWidth", { description: "Box width." });
    this.defineValue(Mesh, "boxHeight", { description: "Box height." });
    this.defineValue(Mesh, "boxDepth", { description: "Box depth." });
    this.defineValue(Mesh, "sphereRadius", { description: "Sphere/capsule/cylinder radius." });
    this.defineValue(Mesh, "color", { description: "Material color (hex)." });
    this.defineValue(Mesh, "roughness", { description: "PBR roughness 0–1." });
    this.defineValue(Mesh, "metalness", { description: "PBR metalness 0–1." });
    this.defineValue(Mesh, "texture", { description: "Texture URL or res:// URI." });
    this.defineValue(Mesh, "wireframe", { description: "Render as wireframe." });
    this.defineValue(Mesh, "castShadow", { description: "Cast shadow." });
    this.defineValue(Mesh, "receiveShadow", { description: "Receive shadow." });

    this.on(EntitySpawned, () => {
      const game = this.game;
      if (!game.isClient()) return;
      this.#meshHandle = game.renderer.createMesh(
        this.ref,
        this.#buildGeometry(),
        this.#buildMaterial(),
      );
      this.#syncTransform(game);
    });

    this.on(EntityDestroyed, () => {
      const game = this.game;
      if (!game.isClient() || this.#meshHandle === undefined) return;
      game.renderer.destroyMesh(this.#meshHandle);
    });

    this.on(EntityEnableChanged, ({ enabled }) => {
      const game = this.game;
      if (!game.isClient() || this.#meshHandle === undefined) return;
      game.renderer.setMeshVisible(this.#meshHandle, enabled);
    });
  }

  #buildGeometry(): GeometryDesc {
    switch (this.geometryType) {
      case "sphere": return { type: "sphere", radius: this.sphereRadius };
      case "capsule": return { type: "capsule", radius: this.sphereRadius, height: this.boxHeight };
      case "cylinder": return { type: "cylinder", radiusTop: this.sphereRadius, radiusBottom: this.sphereRadius, height: this.boxHeight };
      case "cone": return { type: "cone", radius: this.sphereRadius, height: this.boxHeight };
      case "plane": return { type: "plane", width: this.boxWidth, height: this.boxHeight };
      default: return { type: "box", width: this.boxWidth, height: this.boxHeight, depth: this.boxDepth };
    }
  }

  #buildMaterial(): MaterialDesc {
    return {
      type: "standard",
      color: this.color,
      roughness: this.roughness,
      metalness: this.metalness,
      texture: this.texture || undefined,
      wireframe: this.wireframe,
      castShadow: this.castShadow,
      receiveShadow: this.receiveShadow,
    };
  }

  #syncTransform(game: import("@rebur/engine").ClientGame): void {
    if (this.#meshHandle === undefined) return;
    const t = this.globalTransform;
    game.renderer.setMeshTransform(this.#meshHandle, t.position, t.rotation, t.scale);
  }

  onFrame(): void {
    const game = this.game;
    if (!game.isClient() || this.#meshHandle === undefined) return;
    this.#syncTransform(game);
    game.renderer.updateMeshGeometry(this.#meshHandle, this.#buildGeometry());
    game.renderer.updateMeshMaterial(this.#meshHandle, this.#buildMaterial());
  }
}
