import { Empty, Entity, EntityContext, IBounds } from "@rebur/engine";
import { Facades } from "./manager.ts";

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

  get bounds(): IBounds | undefined {
    return undefined;
  }

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
  }
}
