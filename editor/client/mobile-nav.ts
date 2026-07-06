/**
 * Mobile navigation bar — switches between editor panels on small screens.
 * On desktop (>600px) the nav is hidden via CSS and has no effect.
 */

const PANELS = [
  { id: "game", label: "Game", emoji: "🎮" },
  { id: "project", label: "Project", emoji: "📁" },
  { id: "inspector", label: "Inspector", emoji: "🔎" },
  { id: "panels", label: "Panels", emoji: "☰" },
] as const;

type PanelId = (typeof PANELS)[number]["id"];

export function setupMobileNav(uiRoot: HTMLElement): void {
  // Default to game view on first load
  if (!uiRoot.hasAttribute("data-mobile-panel")) {
    uiRoot.setAttribute("data-mobile-panel", "game");
  }

  const nav = document.createElement("nav");
  nav.id = "mobile-nav";
  nav.setAttribute("aria-label", "Panel navigation");

  for (const panel of PANELS) {
    const btn = document.createElement("button");
    btn.className = "mobile-nav-btn";
    btn.dataset["panel"] = panel.id;
    btn.setAttribute("aria-label", panel.label);
    btn.type = "button";

    const iconSpan = document.createElement("span");
    iconSpan.className = "mobile-nav-icon";
    iconSpan.textContent = panel.emoji;
    iconSpan.setAttribute("aria-hidden", "true");

    const labelSpan = document.createElement("span");
    labelSpan.className = "mobile-nav-label";
    labelSpan.textContent = panel.label;

    btn.append(iconSpan, labelSpan);

    btn.addEventListener("click", () => {
      uiRoot.setAttribute("data-mobile-panel", panel.id);
      nav.querySelectorAll<HTMLElement>(".mobile-nav-btn").forEach(b =>
        b.removeAttribute("data-active"),
      );
      btn.setAttribute("data-active", "");
    });

    nav.append(btn);
  }

  // Highlight the initially-active button
  const current = uiRoot.getAttribute("data-mobile-panel") as PanelId;
  const activeBtn = nav.querySelector<HTMLElement>(`[data-panel="${current}"]`);
  activeBtn?.setAttribute("data-active", "");

  uiRoot.appendChild(nav);
}
