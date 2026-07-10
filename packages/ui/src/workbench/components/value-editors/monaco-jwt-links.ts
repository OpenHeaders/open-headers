/**
 * Monaco affordance plane for detected JWTs. Link detection is OFF in
 * our editors (`links: false` — "Follow link" on random urls adds no
 * value there), so the affordance is decoration-driven: each token
 * gets an underline decoration whose trusted hover markdown carries a
 * clickable "Edit JWT" `command:` link; cmd/ctrl+click is handled by
 * the hook's own mouse listener. The command registers once per
 * Monaco instance; models opt in per editor via
 * {@link attachJwtEditTarget}. React glue (modal state + write-back)
 * lives in `useMonacoJwtEdit`.
 */

import { isMac } from '@openheaders/ui/shared/platform';
import { isJWT, scanForJWTs } from '@openheaders/ui/shared/value-detection';
import type * as monaco from 'monaco-editor';

export const JWT_EDIT_COMMAND = 'oh-jwt.edit';

/** Inline class the underline style hangs off (see rules.less). */
export const JWT_LINK_CLASS = 'oh-jwt-token-link';

const CLICK_HINT = isMac ? 'cmd + click' : 'ctrl + click';

export interface JwtLinkTarget {
  model: monaco.editor.ITextModel;
  /** 0-based char offsets of the token in the model at click time. */
  start: number;
  end: number;
  token: string;
}

/** The subset of `ITextModel` the decoration builder reads — narrow so
 *  tests can drive it with a plain stub. */
export interface JwtLinkModel {
  getValue(): string;
  getPositionAt(offset: number): { lineNumber: number; column: number };
}

export interface JwtDecorationSpec {
  range: monaco.IRange;
  options: {
    inlineClassName: string;
    hoverMessage: { value: string; isTrusted: boolean };
  };
}

/** Scans a model and shapes each hit as an underline decoration whose
 *  hover carries the clickable edit command. The command query holds
 *  `[registrationId, start, end]` in the encoded-JSON form Monaco's
 *  CommandOpener spreads back into command arguments. */
export function buildJwtDecorations(model: JwtLinkModel, registrationId: number): JwtDecorationSpec[] {
  return scanForJWTs(model.getValue()).map((hit) => {
    const startPos = model.getPositionAt(hit.start);
    const endPos = model.getPositionAt(hit.end);
    const commandUrl = `command:${JWT_EDIT_COMMAND}?${encodeURIComponent(
      JSON.stringify([registrationId, hit.start, hit.end]),
    )}`;
    return {
      range: {
        startLineNumber: startPos.lineNumber,
        startColumn: startPos.column,
        endLineNumber: endPos.lineNumber,
        endColumn: endPos.column,
      },
      options: {
        inlineClassName: JWT_LINK_CLASS,
        hoverMessage: { value: `[Edit JWT](${commandUrl}) (${CLICK_HINT})`, isTrusted: true },
      },
    };
  });
}

type OpenHandler = (target: JwtLinkTarget) => void;

interface Registration {
  model: monaco.editor.ITextModel;
  onOpen: OpenHandler;
}

// Module-global registry — the command registers once per Monaco
// instance while editors come and go.
const byId = new Map<number, Registration>();
let nextRegistrationId = 1;
const registeredApis = new WeakSet<typeof monaco>();

/** Command body — resolves a hover link's `[id, start, end]` args back
 *  to the registered model and opens its handler. Exported for tests. */
export function openJwtTarget(id: number, start: number, end: number): void {
  const reg = byId.get(id);
  if (!reg) return;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start) return;
  // Decorations refresh debounced — the buffer may have moved under a
  // stale hover. Only open on a still-valid token.
  const token = reg.model.getValue().slice(start, end);
  if (!isJWT(token)) return;
  reg.onOpen({ model: reg.model, start, end, token });
}

/** Registers the edit command on this Monaco instance (idempotent). */
export function registerJwtLinkPlane(monacoApi: typeof monaco): void {
  if (registeredApis.has(monacoApi)) return;
  registeredApis.add(monacoApi);
  monacoApi.editor.registerCommand(JWT_EDIT_COMMAND, (_accessor, id: number, start: number, end: number) => {
    openJwtTarget(Number(id), Number(start), Number(end));
  });
}

/** Opts a model into JWT edit routing. Returns the registration id
 *  (bake it into the model's decorations via `buildJwtDecorations`)
 *  and the detach function — call it when the editor unmounts. */
export function attachJwtEditTarget(
  model: monaco.editor.ITextModel,
  onOpen: OpenHandler,
): { id: number; detach: () => void } {
  const id = nextRegistrationId++;
  byId.set(id, { model, onOpen });
  return {
    id,
    detach: () => {
      byId.delete(id);
    },
  };
}
