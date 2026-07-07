// Drop-in replacement for jsr:@std/fmt/colors (ANSI terminal colors).

const enabled = !Deno.noColor;

function code(open: number, close: number): (text: string) => string {
  return text => (enabled ? `\x1b[${open}m${text}\x1b[${close}m` : text);
}

export const bold = code(1, 22);
export const dim = code(2, 22);
export const italic = code(3, 23);
export const underline = code(4, 24);

export const black = code(30, 39);
export const red = code(31, 39);
export const green = code(32, 39);
export const yellow = code(33, 39);
export const blue = code(34, 39);
export const magenta = code(35, 39);
export const cyan = code(36, 39);
export const white = code(37, 39);
export const gray = code(90, 39);
export const brightWhite = code(97, 39);

export const bgBlack = code(40, 49);
export const bgRed = code(41, 49);
export const bgGreen = code(42, 49);
export const bgYellow = code(43, 49);
export const bgBlue = code(44, 49);
export const bgCyan = code(46, 49);
export const bgWhite = code(47, 49);

// deno-lint-ignore no-control-regex
const ANSI_PATTERN = /[\x1b\x9b][[\]()#;?]*(?:\d{1,4}(?:;\d{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

export function stripAnsiCode(text: string): string {
  return text.replace(ANSI_PATTERN, "");
}
