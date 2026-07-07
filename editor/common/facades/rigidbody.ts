import { Entity, EntityContext, enumAdapter, Rigidbody } from "@rebur/engine";
import { EnsureCompatible, EntityValueProps } from "./_compatibility.ts";
import { Facades } from "./manager.ts";

type RigidBodyType = (typeof rigidbodyTypes)[number];
const rigidbodyTypes = [
  "dynamic",
  "fixed",
  // "kinematic-position",
  // "kinematic-velocity",
  // TODO: Implement these nicely
] as const;

export const RigidbodyTypeAdapter = enumAdapter(rigidbodyTypes);

export class EditorFacadeRigidbody extends Entity {
  static {
    Entity.registerType(this, "@editor");
    Facades.register(Rigidbody, this);
  }

  type: RigidBodyType = "dynamic";
  gravityScale: number = 1;
  linearDamping: number = 0;
  angularDamping: number = 0;
  ccd: boolean = false;

  static readonly icon = Rigidbody.icon;
  readonly bounds = undefined;

  constructor(ctx: EntityContext) {
    super(ctx);
    this.defineValue(EditorFacadeRigidbody, "type", {
      type: RigidbodyTypeAdapter,
      description: "Defines the type of the rigidbody, such as dynamic or fixed.",
    });
    this.defineValue(EditorFacadeRigidbody, "gravityScale", {
      description: "Gravity scale multiplier.",
    });
    this.defineValue(EditorFacadeRigidbody, "linearDamping", {
      description: "Linear velocity damping.",
    });
    this.defineValue(EditorFacadeRigidbody, "angularDamping", {
      description: "Angular velocity damping.",
    });
    this.defineValue(EditorFacadeRigidbody, "ccd", {
      description: "Continuous collision detection.",
    });
  }
}

type _HasAllValues = EnsureCompatible<
  Omit<EntityValueProps<Rigidbody>, "body" | "bodyHandle" | "colliderHandle" | "linearVelocity" | "angularVelocity">,
  EntityValueProps<EditorFacadeRigidbody>
>;
