import { DefaultCharacter, Entity, EntityContext } from "@rebur/engine";
import { EnsureCompatible, EntityValueProps } from "./_compatibility.ts";
import { EditorFacadeCharacterController } from "./character-controller.ts";
import { Facades } from "./manager.ts";

export class EditorFacadeDefaultCharacter extends EditorFacadeCharacterController {
  static {
    Entity.registerType(this, "@editor");
    Facades.register(DefaultCharacter, this);
  }

  public static override readonly icon = DefaultCharacter.icon;

  public moveSpeed: number = 6;
  public sprintMultiplier: number = 1.6;
  public jumpHeight: number = 1.2;
  public gravity: number = 24;
  public cameraDistance: number = 5;
  public cameraHeight: number = 1.6;
  public mouseSensitivity: number = 0.0025;
  public possessCamera: boolean = true;
  public bodyColor: number = 0x4f8dff;

  constructor(ctx: EntityContext) {
    super(ctx);
    this.defineValue(EditorFacadeDefaultCharacter, "moveSpeed", {
      description: "Walk speed (units/s).",
    });
    this.defineValue(EditorFacadeDefaultCharacter, "sprintMultiplier", {
      description: "Speed multiplier while sprinting (Shift).",
    });
    this.defineValue(EditorFacadeDefaultCharacter, "jumpHeight", {
      description: "Jump height (units).",
    });
    this.defineValue(EditorFacadeDefaultCharacter, "gravity", {
      description: "Gravity (units/s²).",
    });
    this.defineValue(EditorFacadeDefaultCharacter, "cameraDistance", {
      description: "Third-person camera distance. 0 = first person.",
    });
    this.defineValue(EditorFacadeDefaultCharacter, "cameraHeight", {
      description: "Camera eye height.",
    });
    this.defineValue(EditorFacadeDefaultCharacter, "mouseSensitivity", {
      description: "Look sensitivity (radians per pixel).",
    });
    this.defineValue(EditorFacadeDefaultCharacter, "possessCamera", {
      description: "Spawn and control a camera for this character.",
    });
    this.defineValue(EditorFacadeDefaultCharacter, "bodyColor", {
      description: "Capsule body color.",
    });
  }
}

type _HasAllValues = EnsureCompatible<
  Omit<
    EntityValueProps<DefaultCharacter>,
    "collider" | "isGrounded" | "teleport" | "correctedPosition" | "colliderHandle"
  >,
  EntityValueProps<EditorFacadeDefaultCharacter>
>;
