// Drop-in replacement for jsr:@std/jsonc — JSON with comments and trailing commas.

export function parse(text: string): unknown {
  return JSON.parse(stripJsonComments(text));
}

/** Remove // and /* *\/ comments plus trailing commas, preserving string contents. */
function stripJsonComments(text: string): string {
  let result = "";
  let i = 0;
  let inString = false;

  while (i < text.length) {
    const c = text[i];

    if (inString) {
      result += c;
      if (c === "\\") {
        result += text[i + 1] ?? "";
        i += 2;
        continue;
      }
      if (c === '"') inString = false;
      i += 1;
      continue;
    }

    if (c === '"') {
      inString = true;
      result += c;
      i += 1;
      continue;
    }

    if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i += 1;
      continue;
    }

    if (c === "/" && text[i + 1] === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }

    result += c;
    i += 1;
  }

  // strip trailing commas (outside strings, which were preserved verbatim above)
  return result.replace(/,(\s*[}\]])/g, "$1");
}
