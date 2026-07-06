import { connectionDetails } from "@rebur/client/util/server-url.ts";
import { ClientGame } from "@rebur/engine";
import { element as elem } from "@rebur/ui";

// Monaco global — loaded from CDN via loader script in index.html
declare const require: {
  config(opts: Record<string, unknown>): void;
  (deps: string[], callback: (m: unknown) => void): void;
};

// Minimal typings for the Monaco APIs we use
interface MonacoUri { toString(): string }
interface MonacoModel {
  getValue(): string;
}
interface MonacoEditorInstance {
  setModel(model: MonacoModel | null): void;
  getValue(): string;
  onDidChangeModelContent(listener: () => void): { dispose(): void };
}
interface MonacoStatic {
  editor: {
    create(el: HTMLElement, opts: Record<string, unknown>): MonacoEditorInstance;
    getModel(uri: MonacoUri): MonacoModel | null;
    createModel(value: string, lang: string, uri: MonacoUri): MonacoModel;
    defineTheme(name: string, def: Record<string, unknown>): void;
  };
  Uri: { parse(uri: string): MonacoUri };
}

interface FileState {
  content: string;
  dirty: boolean;
}

export class ScriptEditor {
  #game: ClientGame;
  #container: HTMLElement;
  #tabBar: HTMLElement;
  #editorContainer: HTMLElement;
  #emptyState: HTMLElement;

  #openFiles: Map<string, FileState> = new Map();
  #activeFile: string | null = null;

  #monaco: MonacoStatic | null = null;
  #monacoEditor: MonacoEditorInstance | null = null;
  #monacoReady = false;
  #monacoLoading = false;
  #pendingOpen: string | null = null;

  #saveTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(game: ClientGame) {
    this.#game = game;

    this.#container = elem("div", { className: "script-editor" });
    this.#tabBar = elem("div", { className: "script-editor-tabs" });
    this.#editorContainer = elem("div", { className: "script-editor-monaco" });
    this.#emptyState = elem("div", { className: "script-editor-empty" }, [
      "Double-click a script file in the Project panel,",
      elem("br", {}),
      "or double-click a behavior's script field to open it here.",
    ]);

    this.#container.append(this.#tabBar, this.#editorContainer, this.#emptyState);
    this.#editorContainer.style.display = "none";
  }

  get container(): HTMLElement {
    return this.#container;
  }

  async openFile(path: string): Promise<void> {
    const cleanPath = path.replace(/^\/+/, "");

    if (!this.#openFiles.has(cleanPath)) {
      const url = new URL(
        `${connectionDetails.serverUrl}api/v1/edit/${this.#game.instanceId}/files/${cleanPath}`,
      );
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`[ScriptEditor] Failed to load ${cleanPath}: ${res.status}`);
        return;
      }
      const content = await res.text();
      this.#openFiles.set(cleanPath, { content, dirty: false });
    }

    this.#activeFile = cleanPath;
    this.#renderTabBar();
    this.#editorContainer.style.display = "";
    this.#emptyState.style.display = "none";

    if (!this.#monacoReady) {
      this.#pendingOpen = cleanPath;
      if (!this.#monacoLoading) this.#loadMonaco();
    } else {
      this.#loadFileInEditor(cleanPath);
    }
  }

  // ── Monaco loading ───────────────────────────────────────────────────────

  #loadMonaco(): void {
    this.#monacoLoading = true;
    require.config({
      paths: { vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.0/min/vs" },
    });
    // Monaco AMD loader exposes `monaco` on globalThis, not via the callback argument.
    require(["vs/editor/editor.main"], () => {
      const monacoGlobal = (globalThis as unknown as { monaco?: MonacoStatic }).monaco;
      if (!monacoGlobal) {
        console.error("[ScriptEditor] Monaco loaded but globalThis.monaco is undefined.");
        this.#monacoLoading = false;
        return;
      }
      const monaco = monacoGlobal;
      this.#monaco = monaco;

      monaco.editor.defineTheme("rebur-dark", {
        base: "vs-dark",
        inherit: true,
        rules: [],
        colors: { "editor.background": "#0d1117" },
      });

      this.#monacoEditor = monaco.editor.create(this.#editorContainer, {
        theme: "rebur-dark",
        language: "typescript",
        automaticLayout: true,
        fontSize: 13,
        fontFamily: "Iosevka, 'Fira Code', Consolas, monospace",
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: "on",
        tabSize: 2,
        renderLineHighlight: "gutter",
        padding: { top: 8, bottom: 8 },
      });

      this.#monacoEditor.onDidChangeModelContent(() => {
        if (!this.#activeFile) return;
        const state = this.#openFiles.get(this.#activeFile);
        if (state) {
          state.dirty = true;
          this.#renderTabBar();
        }
        this.#scheduleSave();
      });

      this.#monacoReady = true;
      this.#monacoLoading = false;

      if (this.#pendingOpen) {
        this.#loadFileInEditor(this.#pendingOpen);
        this.#pendingOpen = null;
      }
    });
  }

  #getLanguage(path: string): string {
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    return (
      {
        ts: "typescript",
        tsx: "typescript",
        js: "javascript",
        jsx: "javascript",
        json: "json",
        jsonc: "json",
        css: "css",
        html: "html",
        md: "markdown",
      }[ext] ?? "plaintext"
    );
  }

  #loadFileInEditor(path: string): void {
    if (!this.#monacoEditor || !this.#monaco) return;
    const state = this.#openFiles.get(path);
    if (!state) return;

    const uri = this.#monaco.Uri.parse(`file:///${path}`);
    let model = this.#monaco.editor.getModel(uri);
    if (!model) {
      model = this.#monaco.editor.createModel(state.content, this.#getLanguage(path), uri);
    }
    this.#monacoEditor.setModel(model);
  }

  // ── Tab bar ──────────────────────────────────────────────────────────────

  #renderTabBar(): void {
    this.#tabBar.replaceChildren();
    for (const [path, state] of this.#openFiles) {
      const name = path.split("/").pop() ?? path;
      const isActive = path === this.#activeFile;

      const tab = elem("div", {
        className: `script-tab${isActive ? " active" : ""}`,
        title: path,
      });

      const label = elem("span", { className: "script-tab-name" }, [
        state.dirty ? `${name} ●` : name,
      ]);

      const closeBtn = elem("button", {
        type: "button",
        className: "script-tab-close",
        title: "Close",
      });
      closeBtn.textContent = "×";
      closeBtn.addEventListener("click", e => {
        e.stopPropagation();
        this.#closeFile(path);
      });

      tab.append(label, closeBtn);
      tab.addEventListener("click", () => {
        this.#activeFile = path;
        this.#renderTabBar();
        this.#loadFileInEditor(path);
      });
      this.#tabBar.append(tab);
    }
  }

  #closeFile(path: string): void {
    this.#openFiles.delete(path);
    const remaining = [...this.#openFiles.keys()];

    if (this.#activeFile === path) {
      this.#activeFile = remaining.length > 0 ? remaining[remaining.length - 1] : null;
    }

    if (this.#activeFile) {
      this.#renderTabBar();
      this.#loadFileInEditor(this.#activeFile);
    } else {
      this.#renderTabBar();
      this.#monacoEditor?.setModel(null);
      this.#editorContainer.style.display = "none";
      this.#emptyState.style.display = "";
    }
  }

  // ── Auto-save ────────────────────────────────────────────────────────────

  #scheduleSave(): void {
    if (this.#saveTimeout !== null) clearTimeout(this.#saveTimeout);
    this.#saveTimeout = setTimeout(() => this.#saveActiveFile(), 1500);
  }

  async #saveActiveFile(): Promise<void> {
    if (!this.#activeFile || !this.#monacoEditor) return;
    const state = this.#openFiles.get(this.#activeFile);
    if (!state) return;

    const content = this.#monacoEditor.getValue();
    const url = new URL(
      `${connectionDetails.serverUrl}api/v1/edit/${this.#game.instanceId}/files/${this.#activeFile}`,
    );
    try {
      await fetch(url, {
        method: "PUT",
        body: content,
        headers: { "Content-Type": "text/plain" },
      });
      state.content = content;
      state.dirty = false;
      this.#renderTabBar();
    } catch (err) {
      console.error("[ScriptEditor] Save failed:", err);
    }
  }
}
