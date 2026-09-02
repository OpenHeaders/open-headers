/**
 * The ambient `oh.*` declaration's kind slot — the seam between the
 * Scripts tab (which knows the slot under edit) and the Monaco TS
 * language service (which owns the declaration). The tab writes the
 * kind here; the language service, once bootstrapped, installs the
 * applier that swaps the declaration. Kept apart from the service
 * module so the tab never imports Monaco's TypeScript contribution
 * (the ~8 MB worker bundle the Firefox build stubs out, and a module
 * jsdom cannot load) — a build without the service simply has no
 * applier, and the write is a no-op.
 */

import type { ScriptKind } from '@openheaders/core/scripts';

let applier: ((kind: ScriptKind) => void) | null = null;
let current: ScriptKind = 'pre-request';

/** The language service installs its declaration swapper here. */
export function installScriptAmbientApplier(apply: (kind: ScriptKind) => void): void {
  applier = apply;
  apply(current);
}

/** The Scripts tab's write — the slot under edit; a repeat is a no-op. */
export function setScriptAmbientKind(kind: ScriptKind): void {
  if (kind === current) return;
  current = kind;
  applier?.(kind);
}

/** The kind the declaration currently describes (tests). */
export function currentScriptAmbientKind(): ScriptKind {
  return current;
}
