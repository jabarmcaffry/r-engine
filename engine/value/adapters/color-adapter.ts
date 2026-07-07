import { JsonValue, ValueTypeAdapter } from "@rebur/engine";

/**
 * `Value<ColorAdapter>` stores a CSS color string.
 * Replaces the old PixiJS PIXI.Color-based implementation.
 *
 * Storage format: CSS color string (e.g. "white", "#ff0000", "rgba(255,0,0,1)").
 * Legacy arrays [r,g,b,a] (0–1 float) produced by the old PIXI.Color adapter are
 * transparently converted back to CSS hex strings on read.
 */
export class ColorAdapter extends ValueTypeAdapter<string> {
  static readonly DEFAULT_COLOR = "white";

  isValue(_value: unknown): _value is string {
    return true;
  }

  convertToPrimitive(value: string): JsonValue {
    // Store as a CSS color string — simple and interoperable.
    if (typeof value === "string" && value.length > 0) return value;
    return ColorAdapter.DEFAULT_COLOR;
  }

  convertFromPrimitive(value: JsonValue): string {
    // New format: plain CSS color string.
    if (typeof value === "string" && value.length > 0) return value;

    // Legacy format: RGBA float array [r,g,b,a] from old PIXI.Color.toArray().
    if (Array.isArray(value) && value.length >= 3) {
      const [r, g, b, a = 1] = value as number[];
      const ri = Math.round((r as number) * 255);
      const gi = Math.round((g as number) * 255);
      const bi = Math.round((b as number) * 255);
      if ((a as number) >= 0.9999) {
        return `#${ri.toString(16).padStart(2, "0")}${gi.toString(16).padStart(2, "0")}${bi.toString(16).padStart(2, "0")}`;
      }
      return `rgba(${ri},${gi},${bi},${(a as number).toFixed(4)})`;
    }

    return ColorAdapter.DEFAULT_COLOR;
  }
}
