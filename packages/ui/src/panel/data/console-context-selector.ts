/**
 * Console context-selector model (JS contexts Phase C) — pure derivation
 * from the live {@link JsContext} set to the dropdown's rows and the
 * effective selection. Browser semantics (verified against the frontend
 * sources, per the house rule):
 *
 *   - `top` is the outermost frame's default context, auto-selected
 *     whenever it exists; an explicit pick of a live context wins until
 *     that context dies, then selection falls back to `top`.
 *   - Title: the context's own label/name when present, else `top` for the
 *     top context, else the origin. Subtitle: the origin, when it adds
 *     information over the title.
 *   - Depth indentation: +1 for a non-default (isolated) world, +1 for
 *     leaving the top frame (iframe contexts, dedicated workers) — except
 *     service workers, which are special-cased to top level.
 *   - The selector does NOT filter messages; the separate "Selected
 *     context only" toggle does, joining rows by `contextKey`.
 */

import type { JsContext } from '@openheaders/core/js-contexts';

export interface ConsoleContextRow {
  readonly context: JsContext;
  readonly label: string;
  /** Shown dimmed under the label; `null` when it would repeat the label. */
  readonly subtitle: string | null;
  /** Indentation level, 0-based. */
  readonly depth: number;
  readonly isTop: boolean;
}

/** The outermost frame's default context — the browser's `top`. */
export function isTopContext(context: JsContext): boolean {
  return context.targetKind === 'page' && context.isDefault && context.isTopFrame === true;
}

function depthOf(context: JsContext): number {
  // Service workers sit at top level in the browser's selector.
  if (context.targetKind === 'service-worker' || context.targetKind === 'shared-worker') return 0;
  const frameHop = context.targetKind === 'page' && context.isTopFrame === true ? 0 : 1;
  const worldHop = context.isDefault ? 0 : 1;
  return frameHop + worldHop;
}

function labelOf(context: JsContext): string {
  if (isTopContext(context)) return 'top';
  if (context.name !== '') return context.name;
  return context.origin;
}

/** Dropdown rows in display order: `top` pinned first, the rest in the
 *  registry's first-add order (stable across re-renders). */
export function consoleContextRows(contexts: readonly JsContext[]): ConsoleContextRow[] {
  const rows = contexts.map((context) => {
    const label = labelOf(context);
    return {
      context,
      label,
      // An empty wire origin (unnamed opaque worlds) adds nothing — never
      // render it as a blank dimmed line.
      subtitle: context.origin !== label && context.origin !== '' ? context.origin : null,
      depth: depthOf(context),
      isTop: isTopContext(context),
    };
  });
  return [...rows.filter((row) => row.isTop), ...rows.filter((row) => !row.isTop)];
}

/** The `top` context's key, when one exists. */
export function topContextKey(contexts: readonly JsContext[]): string | null {
  return contexts.find(isTopContext)?.contextKey ?? null;
}

/**
 * Resolve the effective selection: an explicit pick holds while its context
 * is live; otherwise `top`, otherwise the first live context, otherwise
 * nothing. A dead pick falling through to `top` is the browser's
 * reset-on-navigation behavior for free — navigation clears the session's
 * contexts, so the picked key stops resolving.
 */
export function resolveContextSelection(contexts: readonly JsContext[], selectedKey: string | null): string | null {
  if (selectedKey !== null && contexts.some((c) => c.contextKey === selectedKey)) return selectedKey;
  return topContextKey(contexts) ?? contexts[0]?.contextKey ?? null;
}
