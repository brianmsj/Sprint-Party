/**
 * Turn a ServiceNow rich-text field into safe plain text.
 *
 * `acceptance_criteria` / `description` can arrive as any of:
 *   - plain text with `\n`
 *   - HTML fragments (`<p>…</p>`, `<ul><li>…</li></ul>`, `<br>`)
 *   - HTML entities (`&#39;`, `&amp;`, `&nbsp;`)
 *   - a mix of the above
 *
 * We convert to plain text on the server and the UI renders it with CSS
 * `white-space: pre-line`. ServiceNow HTML is never passed to
 * `dangerouslySetInnerHTML`.
 */

const NBSP = " ";

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
  copy: "©",
  reg: "®",
  trade: "™",
};

function decodeEntities(input: string): string {
  return input.replace(
    /&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g,
    (match, body: string) => {
      if (body[0] === "#") {
        const isHex = body[1] === "x" || body[1] === "X";
        const codePoint = isHex
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10);
        if (
          !Number.isFinite(codePoint) ||
          codePoint < 0 ||
          codePoint > 0x10ffff
        ) {
          return match;
        }
        try {
          return String.fromCodePoint(codePoint);
        } catch {
          return match;
        }
      }
      const named = NAMED_ENTITIES[body.toLowerCase()];
      return named ?? match;
    },
  );
}

export function htmlToPlainText(raw: string | null | undefined): string {
  if (!raw) return "";

  let text = raw;

  // Remove script/style blocks (content and all).
  text = text.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "");

  // Line breaks.
  text = text.replace(/<\s*br\s*\/?\s*>/gi, "\n");

  // List items become bullet lines.
  text = text.replace(/<\s*li\b[^>]*>/gi, "\n• ");
  text = text.replace(/<\s*\/\s*li\s*>/gi, "\n");

  // Other block-level elements become newline boundaries.
  text = text.replace(
    /<\s*\/?\s*(p|div|ul|ol|table|thead|tbody|tr|h[1-6]|blockquote|section|header|footer|article|pre)\b[^>]*>/gi,
    "\n",
  );

  // Strip any remaining tags.
  text = text.replace(/<[^>]+>/g, "");

  // Decode entities only after tags are gone.
  text = decodeEntities(text);

  // Tidy whitespace.
  text = text.replace(/\r\n?/g, "\n");
  text = text.split(NBSP).join(" ");
  text = text.replace(/[ \t]+\n/g, "\n");
  text = text.replace(/\n[ \t]+/g, "\n");
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.replace(/[ \t]{2,}/g, " ");

  return text.trim();
}
