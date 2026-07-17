/**
 * Shared MIME-type classification used by every body-rendering surface —
 * the panel's response/payload viewers and the workbench's body editors
 * both answer "what language should Monaco highlight as?" from here so
 * a body can never color differently across surfaces.
 */

export type BodyLanguage = 'json' | 'css' | 'javascript' | 'html';

function isJsonMime(mime: string): boolean {
  return /\bjson\b/i.test(mime);
}

function isXmlMime(mime: string): boolean {
  return /\b(xml|xhtml)\b/i.test(mime);
}

function isCssMime(mime: string): boolean {
  return /\bcss\b/i.test(mime);
}

function isJsMime(mime: string): boolean {
  return /\b(javascript|ecmascript)\b/i.test(mime);
}

function isHtmlMime(mime: string): boolean {
  return /\bhtml\b/i.test(mime);
}

/** `mime` looks like text (either text/*, JSON, or XML variants). */
export function isTextMime(mime: string): boolean {
  return /^text\//i.test(mime) || isJsonMime(mime) || isXmlMime(mime);
}

/** Map a MIME to the Monaco language we should drive the viewer with. */
export function detectLanguage(mime: string): BodyLanguage | null {
  if (isJsonMime(mime)) return 'json';
  if (isCssMime(mime)) return 'css';
  if (isJsMime(mime)) return 'javascript';
  if (isHtmlMime(mime) || isXmlMime(mime)) return 'html';
  return null;
}

/** Does Prettier know how to format this MIME? */
export function canPrettyPrint(mime: string): boolean {
  return isJsonMime(mime) || isCssMime(mime) || isJsMime(mime) || isHtmlMime(mime) || isXmlMime(mime);
}
