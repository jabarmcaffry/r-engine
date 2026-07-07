import type { ClientGame } from "@rebur/engine";
import { preloadInfo } from "@rebur/engine/internal";

export type PreloadInfo = {
  readonly textures?: string[];
  readonly images?: string[];
  readonly spritesheets?: string[];
  readonly audioClips?: string[];

  readonly custom?: () => void | Promise<void>;
};

export function definePreload(
  info: PreloadInfo | (() => PreloadInfo),
): PreloadInfo & { [preloadInfo]: true } {
  const _info = typeof info === "function" ? info() : info;
  return Object.assign(_info, { [preloadInfo]: true as const });
}

/** Preload an image URL using the browser Image API. */
function preloadImage(url: string): Promise<void> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve(); // don't block on failures
    img.src = url;
  });
}

export async function preload(game: ClientGame, info: PreloadInfo): Promise<void> {
  const jobs: Promise<unknown>[] = [];

  if (info.textures) {
    const urls = info.textures.map(url => game.resolveResource(url));
    // Use browser Image preloading — Three.js TextureLoader will reuse the cache.
    jobs.push(Promise.all(urls.map(preloadImage)));
  }

  if (info.images) {
    const urls = info.images.map(url => game.resolveResource(url));
    jobs.push(Promise.all(urls.map(preloadImage)));
  }

  if (info.spritesheets) {
    // In 3D, spritesheets are just images — preload the atlas PNG.
    const urls = info.spritesheets.map(url => game.resolveResource(url));
    jobs.push(Promise.all(urls.map(preloadImage)));
  }

  if (info.audioClips) {
    console.warn("preload: audio clip preloading not yet implemented");
  }

  if (info.custom) {
    const fn = info.custom;
    jobs.push(
      (async () => {
        try {
          await fn();
        } catch (err) {
          console.error("preload: custom preload function threw", err);
        }
      })(),
    );
  }

  await Promise.all(jobs);
}
