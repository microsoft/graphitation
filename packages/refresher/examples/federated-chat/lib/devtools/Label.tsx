import type { ReactNode } from "react";

/** A run of text: plain, a view's or action's name, or what it takes. */
type Part = { readonly kind: "text" | "name" | "args"; readonly text: string };

/** A name, as one starts a label: what follows it in parentheses or brackets is what it takes. */
const NAMED = /[A-Za-z_$][\w$]*(?=\(| \[)/g;

/** Where what a name takes, starting at `from`, ends: its arguments, then its tags. */
function endOfArgs(text: string, from: number): number {
  let end = from;
  if (text[end] === "(") {
    let depth = 0;
    for (; end < text.length; end++) {
      if (text[end] === "(") depth++;
      else if (text[end] === ")" && --depth === 0) break;
    }
    // A label cut short leaves its parentheses open: the rest is its arguments.
    end = Math.min(end + 1, text.length);
  }
  if (text.startsWith(" [", end)) {
    const close = text.indexOf("]", end);
    end = close === -1 ? text.length : close + 1;
  }
  return end;
}

/** Every label in `text`, `name(args)` or `name [tags]`, split from the text around it. */
function partsOf(text: string): Part[] {
  const parts: Part[] = [];
  let at = 0;
  for (const match of text.matchAll(NAMED)) {
    if (match.index < at) continue;
    const after = match.index + match[0].length;
    const end = endOfArgs(text, after);
    if (match.index > at)
      parts.push({ kind: "text", text: text.slice(at, match.index) });
    parts.push(
      { kind: "name", text: match[0] },
      { kind: "args", text: text.slice(after, end) },
    );
    at = end;
  }
  if (at < text.length) parts.push({ kind: "text", text: text.slice(at) });
  return parts;
}

/** A label that is one ref: its name is all before what it takes, spaces included. */
function partsOfRef(text: string): Part[] {
  const brackets = text.indexOf(" [");
  const parens = text.indexOf("(");
  const start =
    parens === -1
      ? brackets
      : brackets === -1
      ? parens
      : Math.min(parens, brackets);
  if (start <= 0) return [{ kind: "name", text }];
  return [
    { kind: "name", text: text.slice(0, start) },
    { kind: "args", text: text.slice(start) },
  ];
}

/**
 * Text with view and action labels in it, each name styled as a key and what it takes dimmed.
 * `single` says the text is one label, whose name may hold spaces and need take nothing.
 */
export function Label({
  text,
  single = false,
}: {
  readonly text: string;
  readonly single?: boolean;
}): ReactNode {
  return (single ? partsOfRef(text) : partsOf(text)).map((part, index) =>
    part.kind === "text" ? (
      part.text
    ) : (
      <span
        key={index}
        className={part.kind === "name" ? "dt-name" : "dt-args"}
      >
        {part.text}
      </span>
    ),
  );
}
