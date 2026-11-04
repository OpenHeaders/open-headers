/**
 * git-console-line-model — the pure shape of one Console-tab command
 * line. The wire hands over facts (the global options the host pinned,
 * the subcommand with its operands, the cwd); this model decides what
 * each token shows under the viewer's posture: the options run folds
 * to one chip (the reference's console folding — hover reads the run,
 * a click lays it open), and an absolute path elides its middle by
 * components, never by characters, so the head and the tail stay
 * whole. Output text is git's own words and never passes through here.
 */

export type ConsoleToken =
  | { kind: 'word'; text: string }
  /** A shortened path: its head, then the elision marker, then its tail; `full` is the token exactly as git received it. */
  | { kind: 'path'; head: string; tail: string; full: string };

export type ConsoleOptionsRun =
  /** The run folded to a chip; `full` is the run, one option per line with its value. */
  | { state: 'folded'; text: string; full: string }
  /** The run laid open; `collapsible` when a click folds it again — then every path is whole, the click was the reveal. */
  | { state: 'open'; tokens: ConsoleToken[]; collapsible: boolean };

export interface ConsoleCommandLine {
  /** Null when the invocation carried no global options. */
  options: ConsoleOptionsRun | null;
  command: ConsoleToken[];
}

export interface ConsoleLinePosture {
  /** Fold the global options to a chip (the Fold Options toggle). */
  foldOptions: boolean;
  /** Elide the middle of absolute paths (the Shorten Paths toggle). */
  shortenPaths: boolean;
  /** This row's run was clicked open. */
  expanded: boolean;
}

/** Path components kept at each end of an elided path. */
const KEEP_HEAD = 2;
const KEEP_TAIL = 2;
/** Fewer hidden components than this and the ellipsis saves nothing. */
const MIN_HIDDEN = 2;

function isAbsolutePath(text: string): boolean {
  return text.startsWith('/') || /^[A-Za-z]:[\\/]/.test(text);
}

/** `--opt=/path` splits into its option prefix and the path; a bare path has an empty prefix. */
function splitPathToken(token: string): { prefix: string; path: string } | null {
  if (isAbsolutePath(token)) return { prefix: '', path: token };
  const valued = /^(--?[\w-]+=)(.+)$/.exec(token);
  if (valued !== null && isAbsolutePath(valued[2])) return { prefix: valued[1], path: valued[2] };
  return null;
}

/**
 * The path's head and tail around its hidden middle components:
 * `/private/tmp/` … `/repo/ws`. The root (`/` or `C:`) rides with the
 * head. Null when fewer than {@link MIN_HIDDEN} components would hide.
 */
export function elidePath(path: string): { head: string; tail: string } | null {
  const sep = path.includes('/') ? '/' : '\\';
  const parts = path.split(sep);
  const rooted = parts[0] === '' || /^[A-Za-z]:$/.test(parts[0]);
  const head = KEEP_HEAD + (rooted ? 1 : 0);
  if (parts.length - head - KEEP_TAIL < MIN_HIDDEN) return null;
  return {
    head: `${parts.slice(0, head).join(sep)}${sep}`,
    tail: `${sep}${parts.slice(parts.length - KEEP_TAIL).join(sep)}`,
  };
}

/**
 * The run laid out one option per line with its value: inside the
 * global-options run every token that does not start with a dash is
 * the value of the option before it (otherwise git would have read it
 * as the subcommand), so the pairing needs no option table.
 */
export function optionsRunLines(options: readonly string[]): string[] {
  const lines: string[] = [];
  for (const token of options) {
    if (token.startsWith('-') || lines.length === 0) lines.push(token);
    else lines[lines.length - 1] = `${lines[lines.length - 1]} ${token}`;
  }
  return lines;
}

/** One token under the posture: a path token elides when the toggle is on and the path has a middle to hide. */
export function consoleToken(token: string, shortenPaths: boolean): ConsoleToken {
  if (shortenPaths) {
    const split = splitPathToken(token);
    const elided = split === null ? null : elidePath(split.path);
    if (split !== null && elided !== null) {
      return { kind: 'path', head: `${split.prefix}${elided.head}`, tail: elided.tail, full: token };
    }
  }
  return { kind: 'word', text: token };
}

/** The command line's tokens under the posture. */
export function consoleCommandLine(
  row: { options: readonly string[]; command: readonly string[] },
  posture: ConsoleLinePosture,
): ConsoleCommandLine {
  let options: ConsoleOptionsRun | null = null;
  if (row.options.length > 0) {
    options =
      posture.foldOptions && !posture.expanded
        ? { state: 'folded', text: `${row.options[0]} …`, full: optionsRunLines(row.options).join('\n') }
        : {
            state: 'open',
            tokens: row.options.map((option) => consoleToken(option, posture.shortenPaths && !posture.foldOptions)),
            collapsible: posture.foldOptions,
          };
  }
  return { options, command: row.command.map((arg) => consoleToken(arg, posture.shortenPaths)) };
}
