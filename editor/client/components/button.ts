import { element as elem, ElementAttributes } from "@rebur/ui";

export class Button extends HTMLElement {
  static {
    customElements.define("rebur-button", this);
  }

  constructor(
    attrs: Partial<ElementAttributes<"button">> = {},
    children: (Element | string | Text)[] = [],
  ) {
    super();

    const element = elem("button", { ...attrs, type: "button" }, children);
    this.append(element);
  }
}
