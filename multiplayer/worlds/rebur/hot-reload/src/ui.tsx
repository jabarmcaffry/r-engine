import { UIBehavior } from "@rebur/engine";
import { BaseElement } from "@rebur/ui";

export default class Ui extends UIBehavior {
  protected render(): BaseElement {
    return <div>hello world</div>;
  }
}
