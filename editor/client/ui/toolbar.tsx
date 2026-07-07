import {
  Camera,
  ClientGame,
  EditorChangeRequiresRestart,
  EditorChangeRestartCleared,
  InternalGameTick,
  PhysicsDebug,
} from "@rebur/engine";
import type { BaseElement } from "@rebur/ui";
import { element as elem } from "@rebur/ui";
import { Gizmo } from "../../common/entities/mod.ts";
import {
  AlertCircle,
  Box,
  ChartLine,
  ChevronDown,
  Icon,
  icon,
  Move,
  Move3D,
  ZoomIn,
} from "../_icons.tsx";
import { stats } from "../_stats.ts";
import type { AspectRatio } from "../aspect-ratio.ts";
import { ASPECT_RATIOS, setAspectRatio } from "../aspect-ratio.ts";
import { InspectorUI, InspectorUIWidget } from "./inspector.ts";

export class Toolbar implements InspectorUIWidget {
  #editMode: boolean = false;

  #toolbar: { main: HTMLElement; left: HTMLElement; center: HTMLElement; right: HTMLElement };
  #overlays: HTMLElement;
  #cursorOverlayEl: BaseElement;
  #keydownHandler?: (event: KeyboardEvent) => void;

  constructor(
    private game: ClientGame,
    private gameContainer: HTMLDivElement,
  ) {
    const left = elem("div", { dataset: { left: "" } });
    const center = elem("div", { dataset: { center: "" } });
    const right = elem("div", { dataset: { right: "" } });
    const main = elem("div", { id: "toolbar" }, [left, center, right]);

    this.#toolbar = { main, left, center, right };
    this.#overlays = elem("div", { id: "overlays" });
    this.#cursorOverlayEl = this.#drawCursorOverlay();
  }

  setup(ui: InspectorUI): void {
    this.#editMode = ui.editMode;
    const mode = this.#editMode ? "edit" : "play";
    this.#toolbar.main.dataset.mode = mode;

    if (this.#editMode) {
      this.#toolbar.left.append(this.#drawGizmoButtons());
      this.#overlays.append(this.#drawCursorOverlay());
      if (globalThis.env.IS_DEV) this.#toolbar.right.append(this.#drawStatsButton());
      this.#toolbar.right.append(this.#drawRatioDropdown());

      // Q — activate transform gizmo
      this.#keydownHandler = (event: KeyboardEvent) => {
        if (
          document.activeElement instanceof HTMLInputElement ||
          document.activeElement instanceof HTMLTextAreaElement ||
          (document.activeElement && (document.activeElement as HTMLElement).isContentEditable)
        ) {
          return;
        }

        if (
          event.key === "q" &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.shiftKey &&
          !event.altKey
        ) {
          event.preventDefault();
          this.#ensureGizmo();
        }
      };
    } else {
      this.#toolbar.left.append(this.#drawPhysicsDebugButton());
      this.#toolbar.right.append(this.#drawStatsButton(), this.#drawRatioDropdown());
    }

    this.game.on(EditorChangeRequiresRestart, e => {
      this.showRestartRequired(e.reason);
    });

    this.game.on(EditorChangeRestartCleared, e => {
      this.clearRestartReason(e.reason);
    });
  }

  show(_uiRoot: HTMLElement): void {
    const gameview = document.querySelector<HTMLDivElement>("div#gameview")!;
    gameview.prepend(this.#toolbar.main);

    this.gameContainer.append(this.#overlays);

    if (this.#keydownHandler) {
      document.addEventListener("keydown", this.#keydownHandler);
    }
  }

  private showRestartRequired(reason: string) {
    const center = this.#toolbar.center;

    let wrap = center.querySelector<HTMLDivElement>(".restart-required");
    if (!wrap) {
      center.innerHTML = "";
      const reloadBtn = elem("button", { type: "button", onClick: () => location.reload() }, [
        "Reload Website",
      ]);
      wrap = elem("div", { classList: ["restart-required"] }, [
        elem("div", { classList: ["trigger"] }, [
          icon(AlertCircle),
          elem("strong", {}, ["Restart Required"]),
        ]),
        elem("div", { classList: ["restart-dropdown"] }, [
          elem("p", {}, ["Changes require a restart to apply."]),
          reloadBtn,
          elem("ul"),
        ]),
      ]) as HTMLDivElement;
      center.append(wrap);
    }

    const list = wrap.querySelector("ul")!;
    const exists = Array.from(list.children).some(li => li.textContent === reason);
    if (!exists) {
      list.append(elem("li", {}, [reason]));
    }
  }

  private clearRestartReason(reason: string) {
    const wrap = this.#toolbar.center.querySelector<HTMLDivElement>(".restart-required");
    if (!wrap) return;
    const list = wrap.querySelector("ul");
    if (!list) return;

    for (const li of Array.from(list.children)) {
      if (li.textContent === reason) {
        li.remove();
        break;
      }
    }

    if (list.children.length === 0) {
      wrap.remove();
      this.#toolbar.center.innerHTML = "";
    }
  }

  hide(): void {
    this.#toolbar.main.remove();
    this.#overlays.remove();
    if (this.#keydownHandler) {
      document.removeEventListener("keydown", this.#keydownHandler);
    }
  }

  /** Spawn or re-activate the 3D transform gizmo. */
  #ensureGizmo(): void {
    if (!this.game.local.children.get(Gizmo.name)?.cast(Gizmo)) {
      const g = this.game.local.spawn({ type: Gizmo, name: Gizmo.name });
      g.mode = "combined";
    }
  }

  #drawGizmoButtons(): BaseElement {
    const button = (
      <button type="button" title="Edit Transform (Q)" data-active="">
        <Icon icon={Move3D} />
        Edit Transform
      </button>
    ) as HTMLButtonElement;

    // Spawn the gizmo immediately so the viewport is interactive on load.
    this.#ensureGizmo();

    return (
      <div id="gizmo-buttons">
        {button}
      </div>
    );
  }

  #drawPhysicsDebugButton(): BaseElement {
    const STORAGE_KEY = "@rebur/editor/show-physics-debug";
    const setState = (value: boolean) => {
      if (value) localStorage.setItem(STORAGE_KEY, "true");
      else localStorage.removeItem(STORAGE_KEY);
    };

    const state = (): boolean => {
      const entities = this.game.local.entities.lookupByType(PhysicsDebug);
      return entities.length > 0;
    };

    const enable = () => {
      const enabled = state();
      if (enabled) return;

      this.game.local.spawn({ type: PhysicsDebug, name: PhysicsDebug.name });
      this.#overlays.append(this.#cursorOverlayEl);
      setState(true);
      refresh();
    };

    const disable = () => {
      const enabled = state();
      if (!enabled) return;

      const entities = this.game.local.entities.lookupByType(PhysicsDebug);
      entities.forEach(e => e.destroy());

      if (this.#cursorOverlayEl.parentElement === this.#overlays) {
        this.#overlays.removeChild(this.#cursorOverlayEl);
      }

      setState(false);
      refresh();
    };

    const toggle = () => {
      const enabled = state();
      if (enabled) disable();
      else enable();
    };

    const refresh = () => {
      const enabled = state();
      if (enabled) button.dataset.active = "";
      else delete button.dataset.active;
    };

    const button = (
      <button type="button" data-active={state()} onClick={toggle}>
        <Icon icon={Box} />
        Show Debug
      </button>
    );

    const startEnabled = localStorage.getItem(STORAGE_KEY) === "true";
    if (startEnabled) {
      enable();
    }

    return button;
  }

  #drawStatsButton(): BaseElement {
    const STORAGE_KEY = "@rebur/editor/show-stats";
    const state = (): boolean => {
      return localStorage.getItem(STORAGE_KEY) === "true";
    };

    const setState = (value: boolean) => {
      if (value) localStorage.setItem(STORAGE_KEY, "true");
      else localStorage.removeItem(STORAGE_KEY);
    };

    const show = () => {
      this.#overlays.append(stats.dom);
      stats.dom.style.position = "absolute";
      stats.dom.style.right = "0px";
      stats.dom.style.left = "";

      setState(true);
      refresh();
    };

    const hide = () => {
      stats.dom.remove();

      setState(false);
      refresh();
    };

    const toggle = () => {
      const shown = state();

      if (shown) hide();
      else show();
    };

    const refresh = () => {
      const shown = state();

      if (shown) button.dataset.active = "";
      else delete button.dataset.active;
    };

    const shown = state();
    const button = (
      <button type="button" data-active={shown}>
        <Icon icon={ChartLine} />
        Show Stats
      </button>
    );

    if (shown) show();
    button.addEventListener("click", () => {
      toggle();
    });

    return button;
  }

  #drawRatioDropdown(): BaseElement {
    const Ratio = (props: {
      readonly ratio: AspectRatio;
      readonly initial: AspectRatio | undefined;
    }): BaseElement => {
      const ratio = props.ratio;
      const label = ratio === "unlocked" ? "Unlocked" : `${ratio[0]}:${ratio[1]}`;
      const value = serialize(ratio);
      const selected = props.initial !== undefined && serialize(props.initial) === value;

      return (
        <option selected={selected} value={value}>
          Aspect Ratio: {label}
        </option>
      );
    };

    const serialize = (ratio: AspectRatio): string => {
      if (ratio === "unlocked") return "unlocked";

      const [w, h] = ratio;
      return `${w}:${h}`;
    };

    const parseValue = (value: string): AspectRatio | undefined => {
      if (value === "unlocked") return "unlocked";

      const [w, h] = value.split(":");
      if (!w || !h) return undefined;

      const width = Number.parseInt(w, 10);
      const height = Number.parseInt(h, 10);
      if (Number.isNaN(width) || Number.isNaN(height)) return undefined;
      return [width, height];
    };

    const STORAGE_KEY = "@rebur/editor/resolution";

    const setRatio = (ratio: AspectRatio) => {
      setAspectRatio(ratio);

      const select = document.querySelector<HTMLDivElement>("div#aspect-ratio-dropdown");
      if (!select) return;

      if (ratio === "unlocked") delete select.dataset.active;
      else select.dataset.active = "";
    };

    const onChange = (ev: Event) => {
      const target = ev.target as HTMLSelectElement;
      const value = parseValue(target.value);
      if (value === undefined) return;

      if (value === "unlocked") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, serialize(value));

      setRatio(value);
    };

    const initial = parseValue(localStorage.getItem(STORAGE_KEY) ?? "") ?? "unlocked";
    setRatio(initial);

    return (
      <div
        id="aspect-ratio-dropdown"
        className="toolbar-select"
        data-active={initial !== "unlocked"}
      >
        <select autocomplete="off" onChange={onChange}>
          {ASPECT_RATIOS.map(ratio => (
            <Ratio initial={initial} ratio={ratio} />
          ))}
        </select>
        <Icon icon={ChevronDown} />
      </div>
    );
  }

  /** Overlay showing the 3D camera position and field-of-view in the editor viewport. */
  #drawCursorOverlay(): BaseElement {
    const fmt = (n: number) => n.toFixed(2);

    const xEl = elem("span", {}, ["0.00"]);
    const yEl = elem("span", {}, ["0.00"]);
    const zEl = elem("span", {}, ["0.00"]);
    const fovEl = elem("span", {}, ["75°"]);

    this.game.on(InternalGameTick, () => {
      const camera = Camera.getActive(this.game);
      if (!camera) return;

      // In orbit mode (editor viewport) show the focus point; otherwise show
      // the camera entity's own world position.
      const pos = camera.orbit ? camera.focus : camera.transform.position;
      xEl.textContent = fmt(pos.x);
      yEl.textContent = fmt(pos.y);
      zEl.textContent = fmt(pos.z);
      fovEl.textContent = `${camera.fov.toFixed(0)}°`;
    });

    return (
      <div id="cursor-overlay">
        <Icon icon={Move} />
        <span>X</span>{xEl}
        <span>Y</span>{yEl}
        <span>Z</span>{zEl}

        <Icon icon={ZoomIn} />
        <span>FOV</span>
        {fovEl}
      </div>
    );
  }
}
