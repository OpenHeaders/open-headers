/**
 * The bundle's redaction (the error reports plan §4.5): a diagnostic
 * bundle may land in a public issue, so what leaves with it has the
 * person's identity, folders and credentials cut by grammar — the
 * folders the host names (its home, the app, its data, its logs, each
 * bound workspace) become placeholders, the home directory under the
 * three operating systems' conventions becomes `<home>` even where the
 * host named nothing, everything else under the home directory and the
 * temporary folders collapse to `…`, the userinfo and the
 * credential-named query values of any URL and e-mail addresses go.
 * Fixed roots, fixed prefixes and a fixed key list, never a guess over
 * content: the URLs, rules and collections the person worked with
 * stay, and the README says so. Only the copies in the archive are
 * rewritten; the files on disk are untouched. Every placeholder is
 * bracketed so a reader sees a removal, never a path that looks wrong.
 */

export const DIAGNOSTICS_HOME_PLACEHOLDER = '<home>';
export const DIAGNOSTICS_TMP_PLACEHOLDER = '<tmp>';
export const DIAGNOSTICS_CREDENTIALS_PLACEHOLDER = '<credentials>';
export const DIAGNOSTICS_REDACTED_PLACEHOLDER = '<redacted>';
export const DIAGNOSTICS_EMAIL_PLACEHOLDER = '<email>';
/** What stands in for whatever followed a collapsed folder. */
export const DIAGNOSTICS_COLLAPSED = '…';

/** A folder the host knows and the placeholder that stands in for it inside the archive. */
export interface DiagnosticsRoot {
  /** The folder as the host knows it — absolute, any separator. */
  path: string;
  /** Bracketed, e.g. `<app>`, `<workspace 1>`. */
  placeholder: string;
  /** True when what follows the folder is the person's own (a workspace, the home) and collapses to `…`. */
  collapse?: boolean;
}

/** The bound workspace folders as roots, numbered in the order given: `<workspace 1>`, `<workspace 2>`, … */
export function workspaceDiagnosticsRoots(rootDirs: readonly string[]): DiagnosticsRoot[] {
  return rootDirs.map((path, index) => ({ path, placeholder: `<workspace ${index + 1}>`, collapse: true }));
}

/**
 * Where a filesystem path may start in free text or JSON: the start of
 * the text, whitespace, a quote, a bracket, `=`, `,`, `:` or `>`, a
 * `file://` scheme, or Vite's `/@fs` — never the middle of a URL path,
 * where `/Users/123` is an API resource.
 */
const PATH_START = `(^|[\\s"'([=,:>]|file:\\/\\/|\\/@fs)`;
/** What may follow a folder's last segment: a separator, a terminator, or the end. */
const SEGMENT_END = `(?![^\\\\/\\s"'<>|?*:)])`;

/** `/Users/<name>` and `/home/<name>` where a path starts. */
const POSIX_HOME = new RegExp(`${PATH_START}\\/(?:Users|home)\\/[^/\\\\\\s"'<>|?*:]+`, 'g');

/** `C:\Users\<name>` under any drive letter that starts a path (not the `e:///` of `file:///`), either slash, doubled inside a JSON string. */
const WINDOWS_HOME = /(^|[^A-Za-z0-9])[A-Za-z]:[\\/]+Users[\\/]+[^\\/\s"'<>|?*:]+/g;

/** macOS's per-user temporary tree (`/var/folders/xx/<hash>/T`) and `/tmp` where a path starts. */
const TMP = new RegExp(
  `${PATH_START}(?:(?:\\/private)?\\/var\\/folders\\/[^/\\s]+\\/[^/\\s]+(?:\\/[TC0])?|\\/tmp)${SEGMENT_END}`,
  'g',
);

/**
 * A stack frame's location anywhere in a line — `scheme://origin/dir/
 * file.js:line:col`, `/dir/file.js:line:col` or `C:\dir\file.js:line:col`
 * after `(`, `@` or whitespace — cut to `file.js:line:col`, the shape
 * the issue body already carries: the origin and the directory name the
 * dev server, the clone under a home directory or a per-user install.
 * Inside a line, not per line, because the funnel's first frame follows
 * its header and its last frame precedes `component stack:`.
 */
const FRAME_LOCATION =
  /(^|[\s(@])((?:[a-z][a-z0-9+.-]*:\/\/[^\s()]+?|\/[^\s():]+?|[A-Za-z]:[\\/][^\s()]+?)):(\d+):(\d+)(?=[)\s]|$)/gm;

/** `scheme://user:password@host` — the userinfo of any URL. */
const URL_USERINFO = /(:\/\/)[^/\s@"'<>]+@/g;

/** The query keys whose values are credentials by name; matched whole, any case. */
export const DIAGNOSTICS_CREDENTIAL_QUERY_KEYS: readonly string[] = [
  'token',
  'access_token',
  'accesstoken',
  'refresh_token',
  'refreshtoken',
  'id_token',
  'idtoken',
  'auth_token',
  'authtoken',
  'api_key',
  'apikey',
  'api-key',
  'x-api-key',
  'key',
  'secret',
  'client_secret',
  'clientsecret',
  'password',
  'passwd',
  'pwd',
  'pass',
  'auth',
  'authorization',
  'credential',
  'credentials',
  'signature',
  'sig',
  'x-amz-signature',
  'x-amz-security-token',
  'x-amz-credential',
  'code',
  'session',
  'session_id',
  'sessionid',
  'sid',
  'jwt',
  'bearer',
  'private_key',
  'privatekey',
  'sas',
];

const CREDENTIAL_QUERY = new RegExp(`([?&#])(${DIAGNOSTICS_CREDENTIAL_QUERY_KEYS.join('|')})=[^&#\\s"'<>]*`, 'gi');

/** `local@domain.tld` with a lettered top-level label and no frame position after it — `fn@index.js:1:2` (a Gecko frame), `@scope/pkg` and `pkg@2026.8.4` are not addresses. */
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}(?![A-Za-z0-9.-]|:\d+:\d+)/g;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The file a frame location names, its query and hash dropped. */
function frameBasename(location: string): string {
  const path = location.split(/[?#]/, 1)[0];
  return path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1);
}

/** A URL prefix keeps its own slash before the placeholder; plain text does not. */
function placeholderAfter(prefix: string, placeholder: string): string {
  return prefix === '/@fs' || prefix === 'file://' ? `${prefix}/${placeholder}` : `${prefix}${placeholder}`;
}

/** The root's path as a pattern tolerant of either separator (and of the doubled backslash inside a JSON string). */
function rootPattern(root: DiagnosticsRoot): RegExp {
  const segments = root.path.split(/[\\/]+/).filter((segment) => segment !== '');
  const body = segments.map(escapeRegExp).join('[\\\\/]+');
  const windows = /^[A-Za-z]:/.test(root.path);
  const start = windows ? '(^|[^A-Za-z0-9])' : `${PATH_START}[\\\\/]+`;
  return new RegExp(`${start}${body}${SEGMENT_END}`, 'g');
}

/**
 * Whatever follows a collapsed placeholder up to the end of the path
 * becomes `…`. A space continues the path only when the word after it
 * still carries a separator (`Application Support/Google/…`), so prose
 * after a path is left alone.
 */
function collapsePattern(placeholder: string): RegExp {
  const segment = `[^\\s"'<>|?*:)]*`;
  return new RegExp(`${escapeRegExp(placeholder)}[\\\\/]${segment}(?: ${segment}[\\\\/]${segment})*`, 'g');
}

/**
 * One pass over any text part of the bundle. Stack frame locations go
 * first, so a frame keeps its file name; then the host's roots, longest
 * path first (a workspace inside the home before the home itself); then
 * the home and temporary conventions; then every collapsing placeholder
 * loses what follows it; then URL credentials and e-mail addresses.
 */
export function redactDiagnosticsText(text: string, roots: readonly DiagnosticsRoot[] = []): string {
  let out = text.replace(
    FRAME_LOCATION,
    (_match, prefix: string, location: string, line: string, col: string) =>
      `${prefix}${frameBasename(location)}:${line}:${col}`,
  );
  const ordered = [...roots].sort((a, b) => b.path.length - a.path.length);
  for (const root of ordered) {
    out = out.replace(rootPattern(root), (_match, prefix: string) => placeholderAfter(prefix, root.placeholder));
  }
  out = out
    .replace(WINDOWS_HOME, `$1${DIAGNOSTICS_HOME_PLACEHOLDER}`)
    .replace(POSIX_HOME, (_match, prefix: string) => placeholderAfter(prefix, DIAGNOSTICS_HOME_PLACEHOLDER))
    .replace(TMP, (_match, prefix: string) => placeholderAfter(prefix, DIAGNOSTICS_TMP_PLACEHOLDER));
  const collapsing = new Set([
    DIAGNOSTICS_HOME_PLACEHOLDER,
    DIAGNOSTICS_TMP_PLACEHOLDER,
    ...ordered.filter((root) => root.collapse).map((root) => root.placeholder),
  ]);
  for (const placeholder of collapsing) {
    out = out.replace(collapsePattern(placeholder), `${placeholder}/${DIAGNOSTICS_COLLAPSED}`);
  }
  return out
    .replace(URL_USERINFO, `$1${DIAGNOSTICS_CREDENTIALS_PLACEHOLDER}@`)
    .replace(CREDENTIAL_QUERY, `$1$2=${DIAGNOSTICS_REDACTED_PLACEHOLDER}`)
    .replace(EMAIL, DIAGNOSTICS_EMAIL_PLACEHOLDER);
}
