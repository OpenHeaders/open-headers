/**
 * Sandbox iframe transport — the browser page's leg of the script
 * broker ⇄ runtime protocol (`@openheaders/core/scripts/broker`). A
 * page that runs scripts mounts ONE hidden iframe of its sandbox page
 * and drives the runtime inside it over `postMessage`: the extension's
 * workbench page mounts the manifest-declared `sandbox.html` (a unique
 * opaque origin, `'unsafe-eval'` scoped to it by the manifest's
 * sandbox CSP), the served web tab mounts the page its daemon serves
 * under the `sandbox` CSP header. Either way the iframe carries
 * `sandbox="allow-scripts"` itself, so the opaque origin never depends
 * on the page's delivery alone — a proxy that drops the header still
 * gets a sandboxed realm.
 *
 * The transport owns the iframe's lifecycle for the broker's seam:
 * `ensureReady` mounts it on the first run and resolves on the realm's
 * `sandbox.ready`, `post` delivers one wire message, `close` removes
 * the element (the broker's idle timer / shutdown) so the next run
 * mounts afresh. Up messages are accepted only from the mounted
 * frame's window — another frame's post never reaches the broker.
 */

import type { ScriptWireMessage } from '@openheaders/core/scripts';
import type { SandboxTransport } from '@openheaders/core/scripts/broker';

/** The mounted frame's test id — the e2e gates find the realm by it. */
export const SANDBOX_IFRAME_TEST_ID = 'oh-page-script-sandbox';

export interface IframeSandboxTransportOptions {
  /** The sandbox page's URL as this page reaches it. */
  src: string;
}

/** The broker's `createTransport` dependency over a sandbox iframe of `src`. */
export function createIframeSandboxTransport(
  options: IframeSandboxTransportOptions,
): (onUp: (message: unknown) => void) => SandboxTransport {
  return (onUp) => {
    let iframe: HTMLIFrameElement | null = null;
    let ready: Promise<void> | null = null;
    let resolveReady: (() => void) | null = null;

    const listener = (event: MessageEvent): void => {
      if (iframe === null || event.source !== iframe.contentWindow) return;
      const data = event.data as ScriptWireMessage | null;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'sandbox.ready') {
        resolveReady?.();
        resolveReady = null;
        return;
      }
      onUp(data);
    };

    return {
      ensureReady() {
        if (ready !== null) return ready;
        ready = new Promise<void>((resolve) => {
          resolveReady = resolve;
          window.addEventListener('message', listener);
          const element = document.createElement('iframe');
          element.setAttribute('sandbox', 'allow-scripts');
          element.src = options.src;
          element.hidden = true;
          element.setAttribute('aria-hidden', 'true');
          element.setAttribute('data-testid', SANDBOX_IFRAME_TEST_ID);
          document.body.appendChild(element);
          iframe = element;
        });
        return ready;
      },
      post(message) {
        iframe?.contentWindow?.postMessage(message, '*');
      },
      close() {
        window.removeEventListener('message', listener);
        iframe?.remove();
        iframe = null;
        ready = null;
        resolveReady = null;
      },
    };
  };
}
