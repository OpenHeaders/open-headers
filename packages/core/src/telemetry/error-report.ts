/**
 * `toErrorReport` — a caught failure becomes a wire report without a
 * character of its message (the error reports plan §4.2 laws 3 and 4).
 *
 * Three readings, each a grammar and never a scrub: the error's class
 * and the engine TEMPLATE its message matched; the stack's frames with
 * only own-origin bundle frames named; the React component stack as a
 * list of identifiers. The fingerprint is a prefix of core's
 * synchronous SHA-256, so the whole conversion stays synchronous — a
 * host can convert inside the failure path it is already in.
 */

import { sha256HexSync } from '../traffic/sha256';
import {
  ERROR_REPORT_BUNDLE_PATTERN,
  ERROR_REPORT_DOM_EXCEPTION_NAMES,
  ERROR_REPORT_IDENTIFIER_PATTERN,
  ERROR_REPORT_MAX_COMPONENT_STACK,
  ERROR_REPORT_MAX_FRAMES,
  type ErrorReport,
  type ErrorReportCode,
  type ErrorReportErrorName,
  ErrorReportErrorNameSchema,
  type ErrorReportFrame,
  type ErrorReportKind,
  type ErrorReportProcess,
  type ErrorReportReason,
  type ErrorReportSurface,
  type ErrorReportTemplate,
} from './error-vocabulary';

/** The thrown value as the UI funnel's `describeError` reads it — never passed through to the wire. */
export interface ErrorReportErrorDescription {
  name: string;
  message: string;
  stack: string | null;
}

/** What a host hands the converter: the failure's place, the described error, and the ring-0 facts where there is no error. */
export interface ErrorReportInput {
  kind: ErrorReportKind;
  process: ErrorReportProcess;
  /** The workbench unit whose boundary caught a render error (slice 4 passes the funnel's `unit` through). */
  surface?: ErrorReportSurface;
  /** Absent for the ring-0 kinds (a gone process has no error object). */
  error?: ErrorReportErrorDescription;
  /** React's component stack for the render kind; null or absent otherwise. */
  componentStack?: string | null;
  /** The code one of our own typed errors carries (law 5) — the host maps the class, the converter never guesses one. */
  code?: ErrorReportCode;
  reason?: ErrorReportReason;
  exitCode?: number;
  reopenCount?: number;
}

export interface ErrorReportContext {
  /**
   * The host's own-origin test on a frame's full URL (law 4): the
   * extension's own `chrome-extension://<self>/`, the desktop's `file:`
   * under its asar, a dev server. Anything else is `external`.
   */
  isOwnOrigin(url: string): boolean;
}

export interface MatchedErrorTemplate {
  errorName: ErrorReportErrorName;
  template: ErrorReportTemplate;
  reactError?: number;
}

const BUILT_IN_ERROR_NAMES: ReadonlySet<string> = new Set(
  ErrorReportErrorNameSchema.options.filter((name) => name !== 'other'),
);
const DOM_EXCEPTION_NAMES: ReadonlySet<string> = new Set(ERROR_REPORT_DOM_EXCEPTION_NAMES);

const REACT_MINIFIED = /^Minified React error #(\d+)/;

/**
 * The engine templates in match order, V8's wording beside
 * SpiderMonkey's. Each test reads the message and keeps nothing of it;
 * the first match wins, `other` when none does.
 */
const ENGINE_TEMPLATES: ReadonlyArray<{ template: ErrorReportTemplate; test: (message: string) => boolean }> = [
  {
    template: 'max-call-stack',
    test: (m) => /^Maximum call stack size exceeded/.test(m) || /^too much recursion/.test(m),
  },
  { template: 'out-of-memory', test: (m) => /out of memory/i.test(m) || /^Array buffer allocation failed/.test(m) },
  { template: 'invalid-array-length', test: (m) => /^Invalid array length/i.test(m) },
  { template: 'access-before-init', test: (m) => /before initialization$/.test(m) },
  {
    template: 'assign-to-constant',
    test: (m) => /^Assignment to constant variable/.test(m) || /^invalid assignment to const/.test(m),
  },
  { template: 'not-a-constructor', test: (m) => /is not a constructor$/.test(m) },
  { template: 'not-a-function', test: (m) => /is not a function/.test(m) },
  { template: 'not-iterable', test: (m) => /is not iterable/.test(m) },
  { template: 'not-defined', test: (m) => /is not defined$/.test(m) },
  {
    template: 'cannot-set-property',
    test: (m) => /^Cannot set propert(?:y|ies) /.test(m) || /^can't assign to property/.test(m),
  },
  {
    template: 'cannot-read-property',
    test: (m) =>
      /^Cannot read propert(?:y|ies) /.test(m) || /^can't access property/.test(m) || /is (?:undefined|null)$/.test(m),
  },
];

/**
 * Classify a described error (law 3). React's production throw names
 * its error number; a DOMException's spec name is its template; a
 * SyntaxError mentioning JSON is a parse failure; everything else runs
 * the engine templates. The message is read here and nowhere else.
 */
export function matchErrorTemplate(name: string, message: string): MatchedErrorTemplate {
  const react = REACT_MINIFIED.exec(message);
  if (react) {
    const number = Number.parseInt(react[1], 10);
    const errorName = builtInErrorName(name);
    return number >= 1 && number <= 9999
      ? { errorName, template: 'react-minified', reactError: number }
      : { errorName, template: 'react-minified' };
  }
  if (!BUILT_IN_ERROR_NAMES.has(name) && DOM_EXCEPTION_NAMES.has(name)) {
    return { errorName: 'DOMException', template: name as ErrorReportTemplate };
  }
  const errorName = builtInErrorName(name);
  if (errorName === 'SyntaxError' && /JSON/.test(message)) return { errorName, template: 'json-parse' };
  const matched = ENGINE_TEMPLATES.find((candidate) => candidate.test(message));
  return { errorName, template: matched ? matched.template : 'other' };
}

function builtInErrorName(name: string): ErrorReportErrorName {
  return BUILT_IN_ERROR_NAMES.has(name) ? (name as ErrorReportErrorName) : 'other';
}

// V8 / JavaScriptCore: `    at fn (url:line:col)`, `    at url:line:col`,
// with the optional `async` / `new` prefixes and `[as alias]` suffix.
const V8_FRAME = /^\s*at (?:async )?(?:new )?(?:(.*?) )?\(?([^()]*?):(\d+):(\d+)\)?$/;
// SpiderMonkey (and Safari): `fn@url:line:col`, `@url:line:col`, with the
// `async*` and `promise callback*` prefixes and the `/<` closure suffixes.
const GECKO_FRAME = /^(.*?)@(.+?):(\d+):(\d+)$/;

interface ParsedFrame {
  engine: 'v8' | 'gecko';
  name: string;
  url: string;
  line: number;
  col: number;
}

function parseFrameLine(line: string): ParsedFrame | null {
  const v8 = V8_FRAME.exec(line);
  if (v8) return { engine: 'v8', name: v8[1] ?? '', url: v8[2], line: Number(v8[3]), col: Number(v8[4]) };
  const gecko = GECKO_FRAME.exec(line);
  if (gecko) return { engine: 'gecko', name: gecko[1], url: gecko[2], line: Number(gecko[3]), col: Number(gecko[4]) };
  return null;
}

/** The basename of a frame URL with its query and hash stripped — the only part a bundle frame names. */
function frameBasename(url: string): string {
  const path = url.split(/[?#]/, 1)[0];
  return path.slice(path.lastIndexOf('/') + 1);
}

/**
 * A stack (or a React component stack) with every frame's location cut
 * to its basename and position — for text a person hands over, such as
 * the issue body the root fallback seeds. A frame URL names the origin
 * and the directory the bundle loaded from: a dev server and the clone
 * under a home directory, a per-user install path on Windows. The
 * basename and the line and column are all a source map needs. Lines
 * off the frame grammar (the `name: message` header) pass unchanged.
 */
export function anonymizeStackFrames(stack: string): string {
  return stack
    .split('\n')
    .map((line) => {
      const parsed = parseFrameLine(line);
      if (!parsed) return line;
      const location = `${frameBasename(parsed.url)}:${parsed.line}:${parsed.col}`;
      if (parsed.engine === 'gecko') return `${parsed.name}@${location}`;
      return parsed.name ? `    at ${parsed.name} (${location})` : `    at ${location}`;
    })
    .join('\n');
}

/**
 * The function identifier inside an engine's frame name: the last
 * dotted segment (`Object.method` → `method`), stripped of V8's `[as
 * alias]` and SpiderMonkey's `promise callback*` / `/<` decorations.
 * Anything off the identifier grammar (`<anonymous>`) is no name.
 */
function frameIdentifier(name: string): string | undefined {
  const bare = name.replace(/\s*\[as [^\]]*\]/, '').split('/', 1)[0];
  const last = bare.split('*').pop()?.split('.').pop() ?? '';
  return ERROR_REPORT_IDENTIFIER_PATTERN.test(last) ? last : undefined;
}

/**
 * The wire frames of a stack (law 4): own-origin bundle frames carry
 * file, position and name; every other frame is the `external` marker,
 * consecutive markers fold into one. Header lines (`TypeError: …`) and
 * anything unparseable are skipped. Twenty frames max.
 */
export function parseStackFrames(stack: string, context: ErrorReportContext): ErrorReportFrame[] {
  const frames: ErrorReportFrame[] = [];
  for (const line of stack.split('\n')) {
    if (frames.length >= ERROR_REPORT_MAX_FRAMES) break;
    const parsed = parseFrameLine(line);
    if (!parsed) continue;
    const file = frameBasename(parsed.url);
    const own = ERROR_REPORT_BUNDLE_PATTERN.test(file) && safeIsOwnOrigin(context, parsed.url);
    if (!own) {
      const previous = frames[frames.length - 1];
      if (!(previous && 'external' in previous)) frames.push({ external: true });
      continue;
    }
    const fn = frameIdentifier(parsed.name);
    frames.push(
      fn === undefined
        ? { file, line: parsed.line, col: parsed.col }
        : { file, line: parsed.line, col: parsed.col, fn },
    );
  }
  return frames;
}

function safeIsOwnOrigin(context: ErrorReportContext, url: string): boolean {
  try {
    return context.isOwnOrigin(url);
  } catch {
    return false;
  }
}

// React's component stack lines: `    at Name (url)` (19), `    in Name (created by …)` (18).
const COMPONENT_LINE = /^\s*(?:at|in) ([\w$.]+)(?:\s|$)/;

/**
 * The component stack as identifiers, innermost first, sixteen max
 * (law 4). A dotted display name (`Form.Item`) reads as its last
 * segment, the way a frame's `Object.method` does; a line off the
 * grammar is skipped.
 */
export function parseComponentStack(componentStack: string): string[] {
  const names: string[] = [];
  for (const line of componentStack.split('\n')) {
    if (names.length >= ERROR_REPORT_MAX_COMPONENT_STACK) break;
    const match = COMPONENT_LINE.exec(line);
    if (!match) continue;
    const name = match[1].split('.').pop() ?? '';
    if (ERROR_REPORT_IDENTIFIER_PATTERN.test(name)) names.push(name);
  }
  return names;
}

/** The own frames a fingerprint keys on — the first four, so a deeper caller never splits a group. */
const FINGERPRINT_FRAMES = 4;

/**
 * The group key: the first 16 hex of a SHA-256 over kind, error class,
 * template (with React's number), our code, Electron's reason, and the
 * first four own frames. The surface and the count stay out — one bug
 * in two tabs is one group. `reason` rides along so the gone-process
 * kinds split by cause (an OOM is not a kill).
 */
export function fingerprintErrorReport(report: Omit<ErrorReport, 'fingerprint' | 'count'>): string {
  const template = report.reactError === undefined ? report.template : `${report.template}:${report.reactError}`;
  const own = report.frames
    .filter((frame): frame is Extract<ErrorReportFrame, { file: string }> => 'file' in frame)
    .slice(0, FINGERPRINT_FRAMES)
    .map((frame) => `${frame.file}:${frame.line}:${frame.col}:${frame.fn ?? ''}`)
    .join(',');
  const key = [report.kind, report.errorName ?? '', template ?? '', report.code ?? '', report.reason ?? '', own].join(
    '|',
  );
  return sha256HexSync(key).slice(0, 16);
}

/** Name, message and stack of any thrown value — what a host hands the converter as `error`; a non-Error reads as `Error` with its string form. */
export function describeThrownError(value: unknown): ErrorReportErrorDescription {
  if (value instanceof Error) {
    return { name: value.name || 'Error', message: value.message, stack: value.stack ?? null };
  }
  if (typeof value === 'object' && value !== null) {
    const named = value as { name?: unknown; message?: unknown; stack?: unknown };
    return {
      name: typeof named.name === 'string' && named.name !== '' ? named.name : 'Error',
      message: typeof named.message === 'string' ? named.message : safeString(value),
      stack: typeof named.stack === 'string' ? named.stack : null,
    };
  }
  return { name: 'Error', message: safeString(value), stack: null };
}

function safeString(value: unknown): string {
  try {
    return String(value);
  } catch {
    return '[unprintable]';
  }
}

export interface PathOwnOriginOptions {
  /** Directories (or one file) whose frames are ours: an asar, an app directory, a bundle. Either separator. */
  roots: readonly string[];
  /** Web origins whose frames are ours (a dev server); matched on `origin/`. */
  origins?: readonly string[];
}

function normalizePath(path: string): string {
  const forward = path.replace(/\\/g, '/').replace(/\/+$/, '');
  // A `file:` URL's pathname carries a Windows drive as `/C:/…`.
  return /^\/[A-Za-z]:\//.test(forward) ? forward.slice(1) : forward;
}

/**
 * The own-origin test (law 4) for a Node-hosted process and the
 * documents it serves: a `file:` URL or a bare path (a CommonJS frame
 * carries no scheme) under one of the roots, or any URL on one of the
 * origins. Every other scheme — `node:`, `chrome-extension:`, `blob:`,
 * a user script's `eval` — is foreign; a Windows drive letter is not a
 * scheme.
 */
export function createPathOwnOriginTest(options: PathOwnOriginOptions): ErrorReportContext['isOwnOrigin'] {
  const roots = options.roots.map(normalizePath).filter((root) => root !== '');
  const origins = (options.origins ?? []).map((origin) => `${origin.replace(/\/+$/, '')}/`);
  return (url) => {
    if (origins.some((origin) => url.startsWith(origin))) return true;
    let path: string;
    if (url.startsWith('file:')) {
      try {
        path = decodeURIComponent(new URL(url).pathname);
      } catch {
        return false;
      }
    } else if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(url) && !/^[A-Za-z]:[\\/]/.test(url)) {
      return false;
    } else {
      path = url;
    }
    const normalized = normalizePath(path);
    return roots.some((root) => normalized === root || normalized.startsWith(`${root}/`));
  };
}

/** Convert one caught failure into a wire report with `count` 1; synchronous, never throws on any input. */
export function toErrorReport(input: ErrorReportInput, context: ErrorReportContext): ErrorReport {
  const matched = input.error ? matchErrorTemplate(input.error.name, input.error.message) : null;
  const frames = input.error?.stack ? parseStackFrames(input.error.stack, context) : [];
  const componentStack = input.componentStack ? parseComponentStack(input.componentStack) : [];
  const body: Omit<ErrorReport, 'fingerprint' | 'count'> = {
    kind: input.kind,
    process: input.process,
    ...(input.surface !== undefined ? { surface: input.surface } : {}),
    ...(matched ? { errorName: matched.errorName, template: matched.template } : {}),
    ...(matched?.reactError !== undefined ? { reactError: matched.reactError } : {}),
    ...(input.code !== undefined ? { code: input.code } : {}),
    ...(input.reason !== undefined ? { reason: input.reason } : {}),
    ...(input.exitCode !== undefined && Number.isInteger(input.exitCode) ? { exitCode: input.exitCode } : {}),
    ...(input.reopenCount !== undefined && Number.isInteger(input.reopenCount) && input.reopenCount >= 0
      ? { reopenCount: input.reopenCount }
      : {}),
    frames,
    ...(componentStack.length > 0 ? { componentStack } : {}),
  };
  return { ...body, fingerprint: fingerprintErrorReport(body), count: 1 };
}

/** The serialized size of one report, the law-7 budget's unit. Every field is grammar-pinned ASCII, so bytes are chars. */
export function serializedErrorReportBytes(report: ErrorReport): number {
  return JSON.stringify(report).length;
}
