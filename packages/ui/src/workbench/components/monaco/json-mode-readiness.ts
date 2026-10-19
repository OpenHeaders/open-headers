/**
 * json-mode-readiness — the moment the contribution's JSON mode is up,
 * read at the mode's own seam.
 *
 * The contribution sets its mode up lazily: on the first rich-features
 * request for `json` (an editor attaching a JSON model) its own
 * `onLanguage` callback imports the mode module, which sets the worker
 * accessor and then registers the language's providers synchronously
 * through Monaco's language-feature registries. A registry fires its
 * `onDidChange` synchronously on every `register`, so the first
 * registration after the request is the deterministic sign that the
 * worker is set — no timer, and no reliance on two `import()`s of the
 * same module resolving in order (they do not, in the dev bundle).
 *
 * The registry is watched only from the request on, so the mode stays
 * lazy and the services are up by the time it is read. A registration
 * from any other language fires the same registry; its probe of the
 * worker accessor rejects while the mode is still down, the rejection
 * is swallowed and the watch stays until a probe answers.
 */

import type * as monaco from 'monaco-editor';

/** The slice of a language-feature registry the watch needs. */
export interface ProviderRegistry {
  onDidChange(listener: () => void): monaco.IDisposable;
}

export interface JsonModeReadinessHost {
  /** The first rich-features request for `json` — `languages.onLanguage`. */
  onLanguage(callback: () => void): void;
  /** A registry the mode fills under its configuration, read once the
   *  language is requested (Monaco's services are initialized by then). */
  registry(): ProviderRegistry;
  /** The contribution's worker accessor — rejects until the mode is up. */
  getWorker(): Promise<unknown>;
}

/** Resolves once the mode has set its worker and registered its providers. */
export function whenJsonModeReady(host: JsonModeReadinessHost): Promise<void> {
  return new Promise<void>((resolve) => {
    host.onLanguage(() => {
      const watch = host.registry().onDidChange(() => {
        host.getWorker().then(
          () => {
            watch.dispose();
            resolve();
          },
          () => {},
        );
      });
    });
  });
}
