// Drop-in replacement for jsr:@std/media-types — extension → MIME type lookup.

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=UTF-8",
  ".htm": "text/html; charset=UTF-8",
  ".css": "text/css; charset=UTF-8",
  ".js": "text/javascript; charset=UTF-8",
  ".mjs": "text/javascript; charset=UTF-8",
  ".ts": "video/mp2t",
  ".json": "application/json; charset=UTF-8",
  ".jsonc": "application/json; charset=UTF-8",
  ".map": "application/json; charset=UTF-8",
  ".txt": "text/plain; charset=UTF-8",
  ".md": "text/markdown; charset=UTF-8",
  ".xml": "application/xml",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".bmp": "image/bmp",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
  ".m4a": "audio/mp4",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".wasm": "application/wasm",
  ".zip": "application/zip",
  ".gz": "application/gzip",
  ".pdf": "application/pdf",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".bin": "application/octet-stream",
  ".hdr": "image/vnd.radiance",
  ".ktx2": "image/ktx2",
  ".fbx": "application/octet-stream",
  ".obj": "text/plain; charset=UTF-8",
  ".mtl": "text/plain; charset=UTF-8",
};

/** Accepts an extension (with or without dot) or a media type; returns the full content type. */
export function contentType(extensionOrType: string): string | undefined {
  if (extensionOrType.includes("/")) return extensionOrType;
  const ext = extensionOrType.startsWith(".") ? extensionOrType : `.${extensionOrType}`;
  return TYPES[ext.toLowerCase()];
}
