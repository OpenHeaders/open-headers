/**
 * Sandbox iframe transport — the browser page's leg of the script
 * broker ⇄ runtime protocol (`@openheaders/core/scripts/broker`). A
 * page that runs scripts mounts ONE hidden iframe of its sandbox realm
 * and drives the runtime inside it over `postMessage`: the extension's
 * workbench page mounts the manifest-declared `sandbox.html` by URL (a
 * unique opaque origin, `'unsafe-eval'` scoped to it by the manifest's
 * sandbox CSP), the served web tab mounts core's self-contained
 * sandbox document as `srcdoc` (no network, no served page — an
 * offline tab runs its scripts too). Either way the iframe carries
 * `sandbox="allow-scripts"` itself, so the opaque origin is the
 * frame's own, never the document's delivery.
 *
 * The transport owns the iframe's lifecycle for the broker's seam:
 * `ensureReady` mounts it on the first run and resolves on the realm's
 * `sandbox.ready`, `post` delivers one wire message, `close` removes
 * the element (the broker's idle timer / shutdown) so the next run
 * mounts afresh. Up messages are accepted only from the mounted
 * frame's window — another frame's post never reaches the broker.
 *
 * Readiness is bounded the way the node transports bound theirs (a
 * fork that exits before its ready signal rejects): a frame has no
 * exit, but it has `load` — the document it navigated to has settled,
 * the browser's own error page included. A frame that loaded and
 * still announces nothing within the grace is not the realm (a wrong
 * or unreachable page, a script that never ran); `ensureReady` rejects
 * with the honest sentence, unmounts, and the next run mounts afresh.
 */

import type { ScriptWireMessage } from '@openheaders/core/scripts';
import type { SandboxTransport } from '@openheaders/core/scripts/broker';

/** The mounted frame's test id — the e2e gates find the realm by it. */
export const SANDBOX_IFRAME_TEST_ID = 'oh-page-script-sandbox';

/** How long a loaded frame may stay silent before it is not the realm
 *  — the inline realm announces at the end of its own script, so a
 *  loaded document that has not spoken by then never will. */
export const SANDBOX_READY_GRACE_MS = 2_000;

export const SANDBOX_NOT_READY_MESSAGE = 'The script sandbox loaded without announcing its runtime.';

/** What the frame mounts: a sandbox page by URL, or a self-contained
 *  sandbox document inline. */
export type IframeSandboxTransportOptions =
  | {
      /** The sandbox page's URL as this page reaches it. */
      src: string;
    }
  | {
      /** The sandbox document itself (core's `scriptSandboxDocument`). */
      srcdoc: string;
    };

/** The broker's `createTransport` dependency over a sandbox iframe of the realm. */
export function createIframeSandboxTransport(
  options: IframeSandboxTransportOptions,
): (onUp: (message: unknown) => void) => SandboxTransport {
  return (onUp) => {
    let iframe: HTMLIFrameElement | null = null;
    let ready: Promise<void> | null = null;
    let resolveReady: (() => void) | null = null;
    let rejectReady: ((error: Error) => void) | null = null;
    let graceTimer: ReturnType<typeof setTimeout> | null = null;

    const clearGrace = (): void => {
      if (graceTimer !== null) clearTimeout(graceTimer);
      graceTimer = null;
    };

    const listener = (event: MessageEvent): void => {
      if (iframe === null || event.source !== iframe.contentWindow) return;
      const data = event.data as ScriptWireMessage | null;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'sandbox.ready') {
        clearGrace();
        resolveReady?.();
        resolveReady = null;
        rejectReady = null;
        return;
      }
      onUp(data);
    };

    const unmount = (): void => {
      clearGrace();
      window.removeEventListener('message', listener);
      iframe?.remove();
      iframe = null;
      ready = null;
      resolveReady = null;
      rejectReady = null;
    };

    // The frame settled on a document; the realm speaks by the end of
    // its own script, so a still-silent frame after the grace is dead.
    const onLoad = (): void => {
      if (rejectReady === null || graceTimer !== null) return;
      graceTimer = setTimeout(() => {
        const reject = rejectReady;
        unmount();
        reject?.(new Error(SANDBOX_NOT_READY_MESSAGE));
      }, SANDBOX_READY_GRACE_MS);
    };

    return {
      ensureReady() {
        if (ready !== null) return ready;
        ready = new Promise<void>((resolve, reject) => {
          resolveReady = resolve;
          rejectReady = reject;
          window.addEventListener('message', listener);
          const element = document.createElement('iframe');
          element.setAttribute('sandbox', 'allow-scripts');
          if ('srcdoc' in options) {
            element.srcdoc = options.srcdoc;
          } else {
            element.src = options.src;
          }
          element.hidden = true;
          element.setAttribute('aria-hidden', 'true');
          element.setAttribute('data-testid', SANDBOX_IFRAME_TEST_ID);
          element.addEventListener('load', onLoad);
          document.body.appendChild(element);
          iframe = element;
        });
        return ready;
      },
      post(message) {
        iframe?.contentWindow?.postMessage(message, '*');
      },
      close() {
        unmount();
      },
    };
  };
}
