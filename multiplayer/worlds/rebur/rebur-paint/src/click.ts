import { Behavior, ClickableEntity, MouseDown, ColoredSquare } from "@rebur/engine";
import ColorManager from "./color-manager.ts";

export default class ClickableColorChanger extends Behavior {
  #clickable: ClickableEntity;

  onInitialize(): void {
    this.#clickable = this.entity.cast(ClickableEntity);

    this.listen(this.#clickable, MouseDown, ({ button }) => {
      if (button !== "left") return;

      this.entity._.ColoredSquare.cast(ColoredSquare).color = ColorManager.currentColor;
    });
  }
}
