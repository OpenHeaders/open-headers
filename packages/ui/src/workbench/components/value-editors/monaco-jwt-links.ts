/**
 * Monaco link plane for detected JWTs — marks every JWT inside an
 * opted-in model as a `command:` link, which is the one scheme
 * Monaco's trusted link hover renders as a clickable label ("Edit
 * JWT" in blue, like the built-in "Follow link") AND executes natively
 * on cmd/ctrl+click through its CommandOpener. Registered once per
 * Monaco instance; models opt in per editor via
 * {@link attachJwtEditTarget}. React glue (modal state + write-back)
 * lives in `useMonacoJwtEdit`.
 */

import type * as monaco from 'monaco-editor';
import { isJWT } from './jwt';
import { scanForJWTs } from './scan';

export const JWT_EDIT_COMMAND = 'oh-jwt.edit';

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

/** Scans a model and shapes each hit as a Monaco `command:` link. The
 *  query carries `[registrationId, start, end]` in the encoded-JSON
 *  form Monaco's CommandOpener spreads back into command arguments. */
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
      url: `command:${JWT_EDIT_COMMAND}?${encodeURIComponent(JSON.stringify([registrationId, hit.start, hit.end]))}`,
      tooltip: 'Edit JWT',
    };
  });
}

type OpenHandler = (target: JwtLinkTarget) => void;

interface Registration {
  id: number;
  model: monaco.editor.ITextModel;
  onOpen: OpenHandler;
}

// Module-global registries — the provider + command register once per
// Monaco instance while editors come and go.
const byUri = new Map<string, Registration>();
const byId = new Map<number, Registration>();
let nextRegistrationId = 1;
const registeredApis = new WeakSet<typeof monaco>();

/** Command body — resolves a link's `[id, start, end]` args back to
 *  the registered model and opens its handler. Exported for tests. */
export function openJwtTarget(id: number, start: number, end: number): void {
  const reg = byId.get(id);
  if (!reg) return;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start) return;
  // Monaco recomputes links debounced — the buffer may have moved
  // under a stale link. Only open on a still-valid token.
  const token = reg.model.getValue().slice(start, end);
  if (!isJWT(token)) return;
  reg.onOpen({ model: reg.model, start, end, token });
}

/** Registers the wildcard link provider + the edit command on this
 *  Monaco instance (idempotent). Models without a registration get no
 *  links, so the wildcard costs nothing for uninvolved editors. */
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

  monacoApi.editor.registerCommand(JWT_EDIT_COMMAND, (_accessor, id: number, start: number, end: number) => {
    openJwtTarget(Number(id), Number(start), Number(end));
  });
}

/** Opts a model into JWT links, routing link activation to `onOpen`.
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
