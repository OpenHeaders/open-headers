/**
 * Monaco link plane for detected JWTs — marks every JWT inside an
 * opted-in model as a link ("Edit JWT" on hover, cmd/ctrl+click to
 * follow) and routes the click to the model's registered handler
 * instead of a browser navigation. Registered once per Monaco
 * instance; models opt in per editor via {@link attachJwtEditTarget}.
 * React glue (modal state + write-back) lives in `useMonacoJwtEdit`.
 */

import type * as monaco from 'monaco-editor';
import { isJWT } from './jwt';
import { scanForJWTs } from './scan';

export const JWT_LINK_SCHEME = 'oh-jwt';

export interface JwtLinkTarget {
  model: monaco.editor.ITextModel;
  /** 0-based char offsets of the token in the model at click time. */
  start: number;
  end: number;
  token: string;
}

/** The subset of `ITextModel` the link builder reads — narrow so tests
 *  can drive it with a plain stub. */
export interface JwtLinkModel {
  getValue(): string;
  getPositionAt(offset: number): { lineNumber: number; column: number };
}

/** Scans a model and shapes each hit as a Monaco link whose url
 *  round-trips the registration id + offsets through the opener. The
 *  id is numeric — a model uri can't ride in a link url because
 *  `Uri.parse` percent-decodes it back into ambiguity. */
export function buildJwtLinks(
  model: JwtLinkModel,
  registrationId: number,
): Array<{ range: monaco.IRange; url: string; tooltip: string }> {
  return scanForJWTs(model.getValue()).map((hit) => {
    const startPos = model.getPositionAt(hit.start);
    const endPos = model.getPositionAt(hit.end);
    return {
      range: {
        startLineNumber: startPos.lineNumber,
        startColumn: startPos.column,
        endLineNumber: endPos.lineNumber,
        endColumn: endPos.column,
      },
      url: `${JWT_LINK_SCHEME}:${registrationId}/${hit.start}/${hit.end}`,
      tooltip: 'Edit JWT',
    };
  });
}

/** Parses an `oh-jwt:` uri path back into id + offsets. Exported for
 *  tests; returns null on any malformed input. */
export function parseJwtLinkUrl(path: string): { id: number; start: number; end: number } | null {
  const parts = path.split('/');
  if (parts.length !== 3) return null;
  const [id, start, end] = parts.map(Number);
  if (!Number.isInteger(id) || !Number.isInteger(start) || !Number.isInteger(end)) return null;
  if (start < 0 || end <= start) return null;
  return { id, start, end };
}

type OpenHandler = (target: JwtLinkTarget) => void;

interface Registration {
  id: number;
  model: monaco.editor.ITextModel;
  onOpen: OpenHandler;
}

// Module-global registries — the provider + opener register once per
// Monaco instance while editors come and go.
const byUri = new Map<string, Registration>();
const byId = new Map<number, Registration>();
let nextRegistrationId = 1;
const registeredApis = new WeakSet<typeof monaco>();

/** Registers the wildcard link provider + opener on this Monaco
 *  instance (idempotent). Models without a registration get no links,
 *  so the wildcard costs nothing for uninvolved editors. */
export function registerJwtLinkPlane(monacoApi: typeof monaco): void {
  if (registeredApis.has(monacoApi)) return;
  registeredApis.add(monacoApi);

  monacoApi.languages.registerLinkProvider('*', {
    provideLinks(model) {
      const reg = byUri.get(model.uri.toString());
      if (!reg) return { links: [] };
      return { links: buildJwtLinks(model, reg.id) };
    },
  });

  monacoApi.editor.registerLinkOpener({
    open(resource) {
      if (resource.scheme !== JWT_LINK_SCHEME) return false;
      const parsed = parseJwtLinkUrl(resource.path);
      if (!parsed) return true;
      const reg = byId.get(parsed.id);
      if (!reg) return true;
      // Monaco recomputes links debounced — the buffer may have moved
      // under a stale link. Only open on a still-valid token.
      const token = reg.model.getValue().slice(parsed.start, parsed.end);
      if (!isJWT(token)) return true;
      reg.onOpen({ model: reg.model, start: parsed.start, end: parsed.end, token });
      return true;
    },
  });
}

/** Opts a model into JWT links, routing link clicks to `onOpen`.
 *  Returns the detach function — call it when the editor unmounts. */
export function attachJwtEditTarget(model: monaco.editor.ITextModel, onOpen: OpenHandler): () => void {
  const reg: Registration = { id: nextRegistrationId++, model, onOpen };
  byUri.set(model.uri.toString(), reg);
  byId.set(reg.id, reg);
  return () => {
    if (byUri.get(model.uri.toString()) === reg) byUri.delete(model.uri.toString());
    byId.delete(reg.id);
  };
}
