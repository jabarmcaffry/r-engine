import { element as elem } from "@rebur/ui";
import { InspectorUI, InspectorUIWidget, NewRecommendedActions } from "./inspector.ts";
import { LogViewer } from "./log-viewer.ts";
import { PrefabViewer } from "./prefab-viewer.tsx";
import { Terminal, Box, icon, Bot, Wand, LoaderCircle, CodeXml } from "../_icons.tsx";
import { ClientGame } from "@rebur/engine";
import { Assistant } from "./assistant/assistant.tsx";
import { AISuggestionsPopup } from "./ai-suggestions-popup.tsx";
import { ScriptEditor } from "./script-editor.ts";

export class BottomTabs implements InspectorUIWidget {
  #logViewer: LogViewer;
  #assistant: Assistant;
  #prefabViewer: PrefabViewer;
  #scriptEditor: ScriptEditor;

  #container: HTMLElement;
  #logContent: HTMLElement;
  #prefabContent: HTMLElement;
  #assistantContent: HTMLElement;
  #scriptContent: HTMLElement;

  #switchTab!: (tabId: string) => void;

  constructor(games: { edit: ClientGame; play?: ClientGame }, isPro: boolean) {
    this.#container = elem("div", { className: "bottom-tabs" });

    this.#logContent = elem("div", { id: "log-viewer-content" });
    this.#prefabContent = elem("div", { id: "prefab-viewer-content" });
    this.#assistantContent = elem("div", { id: "assistant-viewer-content" });
    this.#scriptContent = elem("div", { id: "script-editor-content" });

    this.#logViewer = new LogViewer(this.#logContent, games);
    this.#prefabViewer = new PrefabViewer(games.edit, this.#prefabContent);
    this.#assistant = new Assistant(games.edit, this.#assistantContent, isPro);
    this.#scriptEditor = new ScriptEditor(games.edit);
  }

  /** Open a script file by path and switch to the Scripts tab. */
  openScript(path: string): void {
    this.#switchTab("scripts");
    this.#scriptEditor.openFile(path);
  }

  setup(ui: InspectorUI): void {
    const switchTab = (tabId: string) => {
      const tabs = Array.from(this.#container.querySelectorAll(".bottom-tab"));
      for (const tab of tabs) {
        if (!(tab instanceof HTMLElement)) continue;
        const isActive = tab.getAttribute("data-tab-id") === tabId;
        if (isActive) {
          tab.setAttribute("data-active", "");
          if (tabId === "logs") tab.classList.remove("has-new");
        } else {
          tab.removeAttribute("data-active");
        }
      }
      this.#logContent.style.display = tabId === "logs" ? "flex" : "none";
      this.#prefabContent.style.display = tabId === "prefabs" ? "flex" : "none";
      this.#assistantContent.style.display = tabId === "assistant" ? "flex" : "none";
      this.#scriptContent.style.display = tabId === "scripts" ? "flex" : "none";
    };

    // Store for use by openScript()
    this.#switchTab = switchTab;

    // @ts-ignore using globals correctly to save time and energy
    globalThis.bottomBarSwitchTab = switchTab;

    const aiSuggestionsPopup = new AISuggestionsPopup();
    aiSuggestionsPopup.mount(this.#container, false);

    const logsTab = elem("div", { className: "bottom-tab" });
    logsTab.setAttribute("data-tab-id", "logs");
    logsTab.append(icon(Terminal), elem("span", {}, ["Logs"]));

    const prefabsTab = elem("div", { className: "bottom-tab", id: "prefab-tab" });
    prefabsTab.setAttribute("data-tab-id", "prefabs");
    prefabsTab.append(icon(Box), elem("span", {}, ["Prefabs"]));

    const assistantTab = elem("div", { className: "bottom-tab" });
    assistantTab.setAttribute("data-tab-id", "assistant");
    assistantTab.setAttribute("id", "assistant-tab");
    assistantTab.append(icon(Bot), elem("span", {}, ["Assistant"]));

    const scriptsTab = elem("div", { className: "bottom-tab" });
    scriptsTab.setAttribute("data-tab-id", "scripts");
    scriptsTab.append(icon(CodeXml), elem("span", {}, ["Scripts"]));

    setTimeout(() => {
      switchTab("prefabs");
    });

    const recommendedActionsTab = (
      <div
        className="bottom-tab pulse-tab hidden"
        id="recommendedActionsTab"
        data-tab-id="recommendedActions"
      >
        {icon(Wand)} Recommended Actions from AI
      </div>
    );
    const loadingActionsTab = (
      <div
        className="bottom-tab hidden"
        style={{ pointerEvents: "none" }}
        id="loadingActionsTab"
      >
        <span className="loading-spinner">{icon(LoaderCircle)}</span> Loading AI Editor
        Actions...
      </div>
    );

    recommendedActionsTab.addEventListener("click", e => {
      aiSuggestionsPopup.show();
      e.preventDefault();
      e.stopPropagation();
    });

    // @ts-expect-error Global
    (game as ClientGame).on(NewRecommendedActions, e => {
      if (Array.isArray(e.plan) && e.plan.length > 0) {
        aiSuggestionsPopup.setPlan(e.plan);
        recommendedActionsTab.classList.remove("hidden");
        loadingActionsTab.classList.add("hidden");
      } else if (Array.isArray(e.plan) && e.plan.length === 0) {
        aiSuggestionsPopup.setPlan([]);
        aiSuggestionsPopup.hide();
        recommendedActionsTab.classList.add("hidden");
        loadingActionsTab.classList.add("hidden");
      } else if (e.plan === "fail") {
        recommendedActionsTab.classList.add("hidden");
        loadingActionsTab.classList.add("hidden");
      } else {
        loadingActionsTab.classList.remove("hidden");
      }
    });

    const tabBar = elem("div", { className: "bottom-tabs-bar" }, [
      assistantTab,
      prefabsTab,
      logsTab,
      scriptsTab,
      recommendedActionsTab,
      loadingActionsTab,
    ]);

    logsTab.addEventListener("click", () => {
      logsTab.classList.remove("has-new");
    });

    tabBar.addEventListener("click", e => {
      const tab = (e.target as HTMLElement).closest(".bottom-tab");
      if (tab) {
        const tabId = tab.getAttribute("data-tab-id");
        if (tabId && tabId !== "external") switchTab(tabId);
      }
    });

    // Mount ScriptEditor into its content div
    this.#scriptEditor.container && this.#scriptContent.appendChild(this.#scriptEditor.container);

    const content = elem("div", { className: "bottom-tabs-content" }, [
      this.#logContent,
      this.#prefabContent,
      this.#assistantContent,
      this.#scriptContent,
    ]);

    this.#prefabContent.style.display = "none";
    this.#assistantContent.style.display = "flex";
    this.#logContent.style.display = "none";
    this.#scriptContent.style.display = "none";

    // Script content uses flex column (editor takes full height)
    this.#scriptContent.style.flexDirection = "column";

    this.#container.append(tabBar, content);

    this.#logViewer.setup(ui);
    this.#prefabViewer.setup(ui);
    this.#assistant.setup(ui);
  }

  show(uiRoot: HTMLElement): void {
    const bottomBar = uiRoot.querySelector("#bottom-bar");
    if (bottomBar) bottomBar.appendChild(this.#container);
  }

  hide(): void {
    this.#container.remove();
  }
}
