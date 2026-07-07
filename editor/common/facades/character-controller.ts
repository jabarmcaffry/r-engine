import { CharacterController, Entity, EntityContext } from "@rebur/engine";
import { EnsureCompatible, EntityValueProps } from "./_compatibility.ts";
import { EditorFacadeCollider } from "./collider.ts";
import { Facades } from "./manager.ts";

export class EditorFacadeCharacterController extends EditorFacadeCollider {
  static {
    Entity.registerType(this, "@editor");
    Facades.register(CharacterController, this);
  }

  public static override readonly icon = CharacterController.icon;

  public offset: number = 0.0625;
  public radius: number = 0.5;
  public height: number = 1.8;

  constructor(ctx: EntityContext) {
    super(ctx);
    this.defineValue(EditorFacadeCharacterController, "offset", {
      description: "Adjusts the offset for the character controller.",
    });
    this.defineValue(EditorFacadeCharacterController, "radius", {
      description: "Capsule radius.",
    });
    this.defineValue(EditorFacadeCharacterController, "height", {
      description: "Capsule height.",
    });
  }
}

type _HasAllValues = EnsureCompatible<
  Omit<
    EntityValueProps<CharacterController>,
    "collider" | "isGrounded" | "teleport" | "correctedPosition" | "colliderHandle"
  >,
  EntityValueProps<EditorFacadeCharacterController>
>;
