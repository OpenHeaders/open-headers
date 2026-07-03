/**
 * Call-stack frame classification.
 *
 * The Initiator tab's call stack mixes frames from very different
 * origins — your application code, framework runtime, minified vendor
 * bundles, Promise / microtask plumbing. Chrome distinguishes these
 * visually so users can find their own code quickly. We classify each
 * frame against the same signals here as a pure helper.
 */

export interface CallFrameLike {
  functionName?: string;
  url?: string;
  lineNumber?: number;
  columnNumber?: number;
}

export interface CallFrameMeta {
  /** Display name — `(anonymous)` when the frame had no function name. */
  displayName: string;
  isAnonymous: boolean;
  /** True when the function name pattern-matches a minified identifier
   *  (single char like `a`, two-char like `xY`, or all-digits like `78193`). */
  isMinifiedName: boolean;
  /** True when the URL is on a different origin than the inspected page. */
  isThirdParty: boolean;
  /** True when the URL pattern-matches a typical noise frame — anonymous
   *  function inside a chunked/runtime/hashed bundle. Conservative: only
   *  triggers when BOTH the function name is anonymous/minified AND the
   *  URL looks bundler-generated. The view uses this for the "hide
   *  minified noise" toggle. */
  isLikelyNoise: boolean;
}

const MINIFIED_NAME_RE = /^(?:[A-Za-z_$][\w$]{0,1}|\d+)$/;
const BUNDLE_URL_PATTERNS: readonly RegExp[] = [
  /\bchunk[-_]/i,
  /\bruntime[-_]/i,
  /\bvendor[s]?[-_]/i,
  /\bbundle[-_]/i,
  /\bpolyfill[s]?[-_]/i,
  // Hash-only filenames like 2694-6e858cef.js / 1337-e8f6b7805501d.js
  /\/[\da-f]{4,}-[\da-f]{6,}(?:\.\w+)?\.js(?:\?|#|$)/i,
  /\/[\da-f]{8,}(?:\.\w+)?\.js(?:\?|#|$)/i,
];

function looksLikeBundleUrl(url: string | undefined): boolean {
  if (!url) return false;
  return BUNDLE_URL_PATTERNS.some((re) => re.test(url));
}

function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin || null;
  } catch {
    return null;
  }
}

/**
 * V8's "property accessor" synthesized name — e.g. `b.l` for
 * `b.l = function() { ... }`. These aren't real declared function
 * names; the engine just captures the property path. Showing them is
 * misleading (they don't grep cleanly against the bundle either),
 * so we display them as `(anonymous)` — matches Chrome's heuristic.
 */
function isPropertyAccessName(name: string): boolean {
  return name.includes('.');
}

export function computeCallFrameMeta(frame: CallFrameLike, pageOrigin: string | null): CallFrameMeta {
  const rawName = frame.functionName?.trim();
  const isPropertyAccessor = !!rawName && isPropertyAccessName(rawName);
  // `(anonymous)` covers both genuinely-unnamed frames AND V8's
  // property-access synthesized names like `b.l` — neither corresponds
  // to a real source-level identifier worth displaying.
  const isAnonymous = !rawName || isPropertyAccessor;
  const displayName = isAnonymous ? '(anonymous)' : rawName!;
  const isMinifiedName = !!rawName && !isPropertyAccessor && MINIFIED_NAME_RE.test(rawName);
  const frameOrigin = originOf(frame.url);
  const isThirdParty = pageOrigin != null && frameOrigin != null && frameOrigin !== pageOrigin;
  const isLikelyNoise = (isAnonymous || isMinifiedName) && looksLikeBundleUrl(frame.url);
  return { displayName, isAnonymous, isMinifiedName, isThirdParty, isLikelyNoise };
}

/**
 * Filename + line/column extracted for the two-column display layout.
 * The filename is the link-styled portion; the line/column is the muted
 * suffix.
 */
export interface FrameLocation {
  filename: string;
  /** "filename:line" or "filename:line:col" — what the view shows when a
   *  line is known. Empty string when no URL is available. */
  pretty: string;
  /** Just `:line` (or `:line:col`) — rendered in muted text next to the
   *  link-colored filename. Empty when no line is known. */
  lineSuffix: string;
}

function extractFilename(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname || '/';
    const segments = path.split('/');
    return segments[segments.length - 1] || u.hostname || url;
  } catch {
    return url;
  }
}

export function computeFrameLocation(frame: CallFrameLike): FrameLocation {
  if (!frame.url) return { filename: '', pretty: '', lineSuffix: '' };
  const filename = extractFilename(frame.url);
  if (frame.lineNumber == null) return { filename, pretty: filename, lineSuffix: '' };
  // Chrome surfaces V8 0-indexed line numbers; humans expect 1-indexed.
  const human = frame.lineNumber + 1;
  const colSuffix = frame.columnNumber != null ? `:${frame.columnNumber + 1}` : '';
  const lineSuffix = `:${human}${colSuffix}`;
  return { filename, pretty: `${filename}${lineSuffix}`, lineSuffix };
}

/**
 * Build a Function@URL:line text block for clipboard / bug-report use.
 * `Promise.then` and `requestAnimationFrame` async boundaries are
 * preserved as `--- <description> ---` separators so the structure
 * stays legible.
 */
export interface CopyStackInput {
  readonly description?: string;
  readonly callFrames?: readonly CallFrameLike[];
}

export function formatCallStackForCopy(sections: readonly CopyStackInput[]): string {
  const lines: string[] = [];
  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    if (i === 0) {
      // First section's description (if any) becomes the heading.
      if (sec.description) lines.push(sec.description);
    } else {
      lines.push('');
      lines.push(`--- ${sec.description ?? 'async'} ---`);
    }
    for (const f of sec.callFrames ?? []) {
      const meta = computeCallFrameMeta(f, null);
      const loc = computeFrameLocation(f);
      if (loc.pretty && f.url) {
        lines.push(`    at ${meta.displayName} (${f.url}${loc.lineSuffix})`);
      } else {
        lines.push(`    at ${meta.displayName}`);
      }
    }
  }
  return lines.join('\n');
}
