/**
 * RichText — styled text rendered as an HTML overlay positioned in 3D space.
 * The element is an absolutely-positioned div that projects the entity's world position
 * to screen space each frame. Attach to a UILayer's coordinate system for HUD text,
 * or to a world entity for billboarded labels.
 */
import {
  Entity,
  EntitySpawned,
  EntityDestroyed,
  EntityEnableChanged,
  type EntityContext,
  ColorAdapter,
  type IBounds,
  enumAdapter,
  type ClientGame,
} from "@rebur/engine";

type FontStyle = enumAdapter.Union<typeof FontStyleAdapter>;
const FontStyleAdapter = enumAdapter(["normal", "italic", "oblique"]);

type FontWeight = enumAdapter.Union<typeof FontWeightAdapter>;
const FontWeightAdapter = enumAdapter([
  "normal", "bold",
  "100", "200", "300", "400", "500", "600", "700", "800", "900",
]);

type Align = enumAdapter.Union<typeof AlignAdapter>;
const AlignAdapter = enumAdapter(["left", "center", "right"]);

export class RichText extends Entity {
  static {
    Entity.registerType(this, "@core");
  }

  static readonly icon: string = "🔡";

  get bounds(): IBounds | undefined { return undefined; }

  text: string = "Sample Text";
  fontFamily: string = "Inter";
  fontSize: number = 36;
  fontStyle: FontStyle = "normal";
  fontWeight: FontWeight = "normal";
  align: Align = "center";
  color: string = "white";
  stroke: boolean = false;
  strokeColor: string = "black";
  strokeWidth: number = 3;

  #el: HTMLDivElement | undefined;

  constructor(ctx: EntityContext) {
    super(ctx);

    this.defineValue(RichText, "text", { description: "Text content." });
    this.defineValue(RichText, "fontFamily", { description: "Font family." });
    this.defineValue(RichText, "fontSize", { description: "Font size in pixels." });
    this.defineValue(RichText, "fontStyle", { type: FontStyleAdapter, description: "Font style." });
    this.defineValue(RichText, "fontWeight", { type: FontWeightAdapter, description: "Font weight." });
    this.defineValue(RichText, "align", { type: AlignAdapter, description: "Text alignment." });
    this.defineValue(RichText, "color", { type: ColorAdapter, description: "Text color." });
    this.defineValue(RichText, "stroke", { description: "Show text outline." });
    this.defineValue(RichText, "strokeColor", {
      type: ColorAdapter,
      description: "Outline color.",
    });
    this.defineValue(RichText, "strokeWidth", { description: "Outline width in pixels." });

    this.on(EntitySpawned, () => {
      if (!this.game.isClient()) return;
      this.#createElement();
    });

    this.on(EntityDestroyed, () => {
      this.#el?.remove();
      this.#el = undefined;
    });

    this.on(EntityEnableChanged, ({ enabled }) => {
      if (this.#el) this.#el.style.display = enabled ? "block" : "none";
    });
  }

  #createElement(): void {
    const container = (this.game as ClientGame).container;
    if (container.style.position === "") container.style.position = "relative";

    this.#el = document.createElement("div");
    this.#el.style.cssText = [
      "position:absolute",
      "pointer-events:none",
      "white-space:pre",
      "user-select:none",
      "transform:translate(-50%,-50%)",
    ].join(";");
    container.appendChild(this.#el);
    this.#applyStyle();
  }

  #applyStyle(): void {
    if (!this.#el) return;
    this.#el.textContent = this.text;
    this.#el.style.fontFamily = this.fontFamily;
    this.#el.style.fontSize = `${this.fontSize}px`;
    this.#el.style.fontStyle = this.fontStyle;
    this.#el.style.fontWeight = this.fontWeight;
    this.#el.style.textAlign = this.align;
    this.#el.style.color = this.color;
    if (this.stroke) {
      const sw = this.strokeWidth;
      this.#el.style.textShadow = [
        `-${sw}px -${sw}px 0 ${this.strokeColor}`,
        `${sw}px -${sw}px 0 ${this.strokeColor}`,
        `-${sw}px ${sw}px 0 ${this.strokeColor}`,
        `${sw}px ${sw}px 0 ${this.strokeColor}`,
      ].join(",");
    } else {
      this.#el.style.textShadow = "";
    }
  }

  onFrame(): void {
    if (!this.game.isClient() || !this.#el) return;

    this.#applyStyle();

    // Project world position to screen
    const pos = this.globalTransform.position;
    const screen = this.game.renderer.worldToScreen?.(pos);
    if (screen) {
      this.#el.style.left = `${screen.x}px`;
      this.#el.style.top = `${screen.y}px`;
    }
  }

  rerender(): void {
    this.#applyStyle();
  }
}
