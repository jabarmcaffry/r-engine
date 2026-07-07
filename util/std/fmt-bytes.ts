// Drop-in replacement for jsr:@std/fmt/bytes — human-readable byte sizes.

export interface FormatOptions {
  binary?: boolean;
  maximumFractionDigits?: number;
}

const DECIMAL_UNITS = ["B", "kB", "MB", "GB", "TB", "PB"];
const BINARY_UNITS = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];

export function format(bytes: number, options: FormatOptions = {}): string {
  const base = options.binary ? 1024 : 1000;
  const units = options.binary ? BINARY_UNITS : DECIMAL_UNITS;

  if (!Number.isFinite(bytes)) return `${bytes} B`;
  const negative = bytes < 0;
  let value = Math.abs(bytes);

  let unit = 0;
  while (value >= base && unit < units.length - 1) {
    value /= base;
    unit += 1;
  }

  const digits = options.maximumFractionDigits ?? (unit === 0 ? 0 : 2);
  const formatted = value.toFixed(digits).replace(/\.?0+$/, "");
  return `${negative ? "-" : ""}${formatted} ${units[unit]}`;
}
