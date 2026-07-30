/**
 * Socket-style URL recognition for the workbench URL surfaces.
 *
 * Users paste Docker-idiom targets — `unix:///var/run/docker.sock`,
 * `http+unix://%2Fvar%2Frun%2Fdocker.sock/v1.43/containers/json`,
 * `npipe:////./pipe/docker_engine` — that no HTTP stack dials as-is:
 * the app's contract is a PLAIN URL plus the request's Unix-socket
 * setting (the socket dials, the URL's host stays cosmetic). The
 * recognizer names that split so the URL surface can scaffold the
 * setting instead of letting the paste fail as an unresolvable host.
 *
 * Pure string work, no `new URL` — these schemes aren't WHATWG URLs
 * (a percent-encoded host or a `//./pipe/` opaque path both parse
 * wrong), and the caller only needs the split, not a full parse.
 */

export interface RecognizedSocketUrl {
  /** The local socket the URL points at: an absolute Unix socket path,
   *  or a Windows named pipe normalized to its `\\.\pipe\…` spelling. */
  socketPath: string;
  /** Request path (+query) carried alongside the socket, `/`-leading;
   *  empty when the URL named only the socket. */
  requestPath: string;
}

/** `\\.\pipe\name` from the `pipe/…` tail of an npipe URL. */
function namedPipeOf(tail: string): string {
  return `\\\\.\\pipe\\${tail.replaceAll('/', '\\')}`;
}

/**
 * Recognize a socket-style URL. Returns the socket path + the request
 * path riding it, or `null` for anything that isn't one (plain URLs,
 * templates, garbage — the caller's surface stays untouched).
 *
 * Grammars recognized:
 *   - `unix://<abs path>` (also `unix:<abs path>`) — the whole
 *     remainder is the socket; a `:`-separated `:/request/path` tail
 *     (the curl split spelling) becomes the request path.
 *   - `<scheme>+unix://<percent-encoded abs path>[/request/path]` —
 *     the requests-unix-socket idiom; any scheme prefix is accepted
 *     (`http+unix`, `https+unix`, `ws+unix`, …).
 *   - `npipe://[/]/./pipe/<name>` — Docker's Windows engine idiom,
 *     normalized to the `\\.\pipe\<name>` spelling the setting takes.
 */
export function recognizeSocketUrl(input: string): RecognizedSocketUrl | null {
  const url = input.trim();

  const npipe = url.match(/^npipe:\/\/\/{0,2}\.\/pipe\/(.+)$/i);
  if (npipe?.[1] !== undefined && npipe[1] !== '') {
    return { socketPath: namedPipeOf(npipe[1]), requestPath: '' };
  }

  const plusUnix = url.match(/^[a-z][a-z0-9.-]*\+unix:\/\/([^/]+)(\/.*)?$/i);
  if (plusUnix?.[1] !== undefined) {
    let socketPath: string;
    try {
      socketPath = decodeURIComponent(plusUnix[1]);
    } catch {
      return null;
    }
    if (!socketPath.startsWith('/')) return null;
    return { socketPath, requestPath: plusUnix[2] ?? '' };
  }

  if (/^unix:/i.test(url)) {
    let remainder = url.slice('unix:'.length);
    // The authority slashes are optional (`unix:/path` and
    // `unix:///path` both circulate) — but what follows must be an
    // absolute path, so `unix://relative` stays unrecognized instead
    // of the `//` reading as the path's start.
    if (remainder.startsWith('//')) remainder = remainder.slice(2);
    if (!remainder.startsWith('/') || remainder.length < 2) return null;
    // curl's split spelling: `unix:/sock/path:/request/path` — the
    // first `:/` past the socket separates the request path.
    const split = remainder.indexOf(':/');
    if (split > 0) {
      return { socketPath: remainder.slice(0, split), requestPath: remainder.slice(split + 1) };
    }
    return { socketPath: remainder, requestPath: '' };
  }

  return null;
}
