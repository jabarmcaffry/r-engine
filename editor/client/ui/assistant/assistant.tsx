import { connectionDetails } from "@rebur/client/util/server-url.ts";
import { ClientGame } from "@rebur/engine";
import { urlToHTTP } from "@rebur/util/url.ts";
import { InspectorUI } from "../inspector.ts";

export class Assistant {
  game: ClientGame;
  container: HTMLElement;
  ui: InspectorUI | undefined;
  isPro: boolean;

  constructor(game: ClientGame, container: HTMLElement, isPro: boolean) {
    this.game = game;
    this.container = container;
    this.isPro = isPro;
  }

  setup(ui: InspectorUI) {
    this.ui = ui;

    const httpServer = urlToHTTP(connectionDetails.serverUrl);
    const serviceId = encodeURIComponent(this.game.worldId);

    try {
      const coderBaseUrl = new URL("coder-manager", httpServer).toString();

      // AI assistant requires a self-hosted chatbot UI server.
      // Set REBUR_CODE_EDITOR_YJS_URL and run your own chatbot service.
      const chatbotUIUrl = coderBaseUrl.includes("localhost")
        ? "http://localhost:5177"
        : null;

      if (!chatbotUIUrl) return;

      const iframeUrl = `${chatbotUIUrl}/?directory=${decodeURIComponent(
        serviceId,
      )}&baseUrl=${coderBaseUrl}&isPro=${this.isPro}`;

      // 5. Create an iframe to show that coder instance
      const iframe = document.createElement("iframe");
      iframe.style.width = "100%";
      iframe.style.height = "100%";
      iframe.style.border = "none";
      iframe.style.padding = "none";
      iframe.src = iframeUrl;

      // Clear the loading message and append the iframe
      this.container.innerHTML = "";
      this.container.appendChild(iframe);
    } catch {
      // do nothing
    }
  }
}
