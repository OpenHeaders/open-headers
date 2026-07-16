/**
 * Surface identity builder — host-agnostic core.
 *
 * Each renderer surface (popup, workbench tab, DevTools panel, side
 * panel) builds a {@link PresenceIdentity} once at mount. This module
 * owns the host-neutral half: assembling the identity record, observing
 * the raw descriptive `labelContext` (typically bound to
 * `document.title` so other surfaces see exactly what the user sees on
 * the browser tab strip), and best-effort browser detection from the
 * user-agent string. The context is locale-neutral wire data — viewers
 * compose the display label from their own translation of
 * `surfaceKind` plus this context (`surface-label.ts`).
 *
 * The host-coupled half — resolving a peer-addressable navigation handle
 * and the inspected-tab context for DevTools — lives in each host's own
 * surface-identity resolvers, which call {@link buildIdentity} with the
 * platform-specific `appId`, `resolveNavigation`, and `observeContext`
 * inputs. The resolver runs at mount; surfaces never refresh
 * `instanceId` or `navigation` after the first call.
 */

import type {
  AppKind,
  BrowserContext,
  NavigationHandle,
  PresenceIdentity,
  SurfaceKind,
} from '@openheaders/core/protocol';
import { generateUid } from '@openheaders/core/utils';

function detectBrowser(): BrowserContext['browser'] {
  const ua = navigator.userAgent;
  const isFirefox = /Firefox/.test(ua);
  if (isFirefox) return 'firefox';
  if (ua.indexOf('Edg') !== -1) return 'edge';
  if (ua.indexOf('Safari') !== -1 && ua.indexOf('Chrome') === -1) return 'safari';
  // Chrome detection is best-effort — Brave, Vivaldi, and other
  // Chromium derivatives present as Chrome via UA. They behave
  // identically for our purposes.
  if (/Chrome/.test(ua)) return 'chrome';
  return 'other';
}

// `browserContext` is only meaningful for surfaces hosted inside a
// real browser (the browser extension). Desktop (Electron) and CLI
// surfaces leave it undefined per the PresenceIdentity contract;
// grouping/labelling then routes them by `appId` rather than by a
// fake "Chrome" bucket inherited from Electron's user-agent string.
function browserContextForApp(appId: AppKind): BrowserContext | undefined {
  return appId === 'extension' ? { browser: detectBrowser() } : undefined;
}

export type ContextChangeListener = (context: string) => void;

export interface SurfaceIdentityHandle {
  /** The identity record passed to `useAwareness`. Returned reference
   *  changes whenever `labelContext` or `navigation` updates so React
   *  state-comparison consumers see a new object. */
  current(): PresenceIdentity;
  /** Manually override the raw descriptive context. Useful when the
   *  surface wants richer data than `document.title` carries. */
  setContext(context: string): PresenceIdentity;
  /** Observe context updates (`document.title` mutations or async
   *  inspected-tab refreshes). The awareness coordinator subscribes
   *  to this so a context change re-publishes the current claim. */
  onContextChange(listener: ContextChangeListener): () => void;
  /** Tear down internal observers (MutationObserver, polling). */
  dispose(): void;
}

export interface ResolveOptions {
  /** Which app this surface belongs to — supplied by the host resolver. */
  appId: AppKind;
  surfaceKind: SurfaceKind;
  /** Initial context seed before any live observation kicks in.
   *  Omitted leaves `labelContext` unset — viewers fall back to their
   *  own translation of `surfaceKind`. */
  initialContext?: string;
  /** Async navigation handle resolver. The identity is returned
   *  immediately with `navigation` undefined, then the handle is filled
   *  in once the lookup completes. Surfaces that publish before
   *  navigation lands will simply re-publish on the next focus / dirty
   *  change — there is no heartbeat (the awareness lifeline is
   *  connection-bound; see `awareness-lifeline.ts`). */
  resolveNavigation?: () => Promise<NavigationHandle | null>;
  /** Wire a live-context source. Returns a teardown function. The
   *  callback is invoked whenever the context changes, including the
   *  initial value if it differs from the seed. */
  observeContext?: (apply: (context: string) => void) => () => void;
}

/** Assemble a {@link SurfaceIdentityHandle} from host-supplied inputs.
 *  Host-neutral: the platform-specific navigation/context wiring is
 *  injected via {@link ResolveOptions}. */
export function buildIdentity(opts: ResolveOptions): SurfaceIdentityHandle {
  const instanceId = `${opts.surfaceKind}-${generateUid()}`;
  let identity: PresenceIdentity = {
    instanceId,
    surfaceKind: opts.surfaceKind,
    appId: opts.appId,
    browserContext: browserContextForApp(opts.appId),
    labelContext: opts.initialContext,
  };
  const contextListeners = new Set<ContextChangeListener>();

  function applyContext(context: string): void {
    const trimmed = context.trim();
    if (!trimmed || identity.labelContext === trimmed) return;
    identity = { ...identity, labelContext: trimmed };
    for (const l of contextListeners) {
      try {
        l(trimmed);
      } catch {
        /* listener errors must not break the source */
      }
    }
  }

  if (opts.resolveNavigation) {
    void opts
      .resolveNavigation()
      .then((nav) => {
        if (nav) identity = { ...identity, navigation: nav };
      })
      .catch(() => {
        /* navigation stays undefined — fine */
      });
  }

  const teardownContext = opts.observeContext?.((context) => applyContext(context));

  return {
    current() {
      return identity;
    },
    setContext(context) {
      applyContext(context);
      return identity;
    },
    onContextChange(listener) {
      contextListeners.add(listener);
      return () => {
        contextListeners.delete(listener);
      };
    },
    dispose() {
      teardownContext?.();
      contextListeners.clear();
    },
  };
}

/** `document.title` source — used by surfaces whose own title is
 *  entity-aware (workbench `useWorkspaceTabTitle`, popup, sidepanel).
 *  Seeds with the current title and observes `<title>` mutations so
 *  the context tracks the browser tab strip exactly. */
export function observeDocumentTitle(apply: (context: string) => void): () => void {
  if (typeof document === 'undefined') return () => {};
  apply(document.title);
  const head = document.head ?? document.querySelector('head');
  if (!head) return () => {};
  // Observe mutations to `<title>` AND insertion/removal of the
  // element itself (some routers swap it out wholesale).
  const observer = new MutationObserver(() => apply(document.title));
  observer.observe(head, { childList: true, subtree: true, characterData: true });
  return () => observer.disconnect();
}
