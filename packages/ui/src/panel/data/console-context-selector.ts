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
 *     top context, else — for service workers — the script's file name,
 *     else the frame's display name (its URL's last path segment — the
 *     browser's frame label), else the origin — collapsed to its
 *     `host[:port]` when it is a bare origin (unnamed dedicated workers
 *     keep the full script URL, like the browser). Worker-family rows get
 *     the browser's `⚙ ` label prefix. (The browser also suffixes SW rows
 *     `#<version> (<status>)` — that rides its ServiceWorker domain, which
 *     a tab-scoped attach cannot reach.) Subtitle: the literal `Extension`
 *     for extension worlds, else the origin's `host[:port]` (falling back
 *     to the frame URL's host for opaque-origin worlds), and only when it
 *     adds information over the title.
 *   - Order: target groups the way the browser weighs them — the page
 *     session first, then OOPIF sessions, then service workers, then
 *     dedicated/shared workers; sessions tie-break by key. Within the page
 *     session, contexts group by frame (the top frame first, the way the
 *     browser walks frame ancestry); within a frame the main world precedes
 *     the isolated worlds (sorted by name). `top` is pinned first.
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

/** `host[:port]` of an origin URL — the browser's short display form;
 *  `null` when the origin does not parse (opaque worlds). */
function originDomain(origin: string): string | null {
  try {
    return new URL(origin).host || null;
  } catch {
    return null;
  }
}

/** A bare origin (no path or query) belongs to a frame; a worker / service
 *  worker context carries its script URL, which must stay whole. */
function isBareOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (url.pathname === '/' || url.pathname === '') && url.search === '';
  } catch {
    return false;
  }
}

/** The browser's frame label — the URL's last path segment, else `host/`. */
function urlDisplayName(frameUrl: string): string | null {
  try {
    const url = new URL(frameUrl);
    const last = url.pathname.split('/').filter(Boolean).pop();
    return last ?? (url.host !== '' ? `${url.host}/` : null);
  } catch {
    return null;
  }
}

function isWorkerFamily(kind: JsContext['targetKind']): boolean {
  return kind === 'worker' || kind === 'service-worker' || kind === 'shared-worker';
}

function baseLabelOf(context: JsContext): string {
  if (context.name !== '') return context.name;
  // A service worker labels by its script's file name, the browser's form.
  if (context.targetKind === 'service-worker' || context.targetKind === 'shared-worker') {
    const file = urlDisplayName(context.origin);
    if (file !== null) return file;
  }
  if (context.frameUrl !== undefined) {
    const displayName = urlDisplayName(context.frameUrl);
    if (displayName !== null) return displayName;
  }
  if (isBareOrigin(context.origin)) return originDomain(context.origin) ?? context.origin;
  return context.origin;
}

function labelOf(context: JsContext): string {
  if (isTopContext(context)) return 'top';
  const label = baseLabelOf(context);
  // The browser's worker-target decoration — a literal gear prefix.
  return isWorkerFamily(context.targetKind) ? `⚙ ${label}` : label;
}

function subtitleFor(context: JsContext, label: string): string | null {
  if (context.origin.startsWith('chrome-extension://')) return 'Extension';
  // Opaque-origin worlds (utility worlds report `://`) fall back to their
  // frame's host — the browser's `securityOrigin` fallback.
  const domain =
    originDomain(context.origin) ?? (context.frameUrl !== undefined ? originDomain(context.frameUrl) : null);
  return domain !== null && domain !== label ? domain : null;
}

/** The browser's target-group weight — higher sorts earlier. */
const SESSION_WEIGHT: Record<JsContext['targetKind'], number> = {
  page: 5,
  iframe: 4,
  'service-worker': 3,
  worker: 2,
  'shared-worker': 2,
};

/** The session prefix of a contextKey (everything before the last `::`). */
function sessionOf(contextKey: string): string {
  const separator = contextKey.lastIndexOf('::');
  return separator === -1 ? contextKey : contextKey.slice(0, separator);
}

function compareRows(mainFrameId: string | undefined, a: ConsoleContextRow, b: ConsoleContextRow): number {
  if (a.isTop !== b.isTop) return a.isTop ? -1 : 1;
  const weight = SESSION_WEIGHT[b.context.targetKind] - SESSION_WEIGHT[a.context.targetKind];
  if (weight !== 0) return weight;
  const session = sessionOf(a.context.contextKey).localeCompare(sessionOf(b.context.contextKey));
  if (session !== 0) return session;
  // Within one session, group by frame — the top frame's contexts first
  // (the browser walks frame ancestry; we know the root), the rest by id.
  const frameA = a.context.frameId ?? '';
  const frameB = b.context.frameId ?? '';
  if (frameA !== frameB) {
    if (mainFrameId !== undefined) {
      if (frameA === mainFrameId) return -1;
      if (frameB === mainFrameId) return 1;
    }
    return frameA.localeCompare(frameB);
  }
  if (a.context.isDefault !== b.context.isDefault) return a.context.isDefault ? -1 : 1;
  if (!a.context.isDefault) return a.context.name.localeCompare(b.context.name);
  // Same-frame main worlds keep arrival order.
  return 0;
}

/** Dropdown rows in the browser's display order (see the module doc). */
export function consoleContextRows(contexts: readonly JsContext[]): ConsoleContextRow[] {
  const rows = contexts.map((context) => {
    const label = labelOf(context);
    return {
      context,
      label,
      subtitle: subtitleFor(context, label),
      depth: depthOf(context),
      isTop: isTopContext(context),
    };
  });
  const mainFrameId = contexts.find(isTopContext)?.frameId;
  return rows.sort((a, b) => compareRows(mainFrameId, a, b));
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
