/**
 * Firefox stub for the Monaco TS/JS language service. The real module
 * (`ts-language-service.ts`) bundles Monaco's TypeScript compiler as an
 * ~8 MB `ts.worker`, which exceeds Firefox add-on validation's 5 MB
 * per-file limit. The Firefox build aliases the real module to this
 * no-op (see the extension's `vite.config.ts`): JS/TS keep syntax
 * highlighting via `basic-languages` in `bootstrap.ts`, but there is no
 * worker-backed language service (no semantic completions/diagnostics).
 *
 * The exports mirror `ts-language-service.ts` exactly so `bootstrap.ts`
 * is agnostic to which half it got.
 */

/** No-op: the TS language service is omitted from the Firefox build. */
export function configureTsLanguageService(): void {}

/** No worker: Firefox ships no TS language service, so `getWorker` falls
 *  back to the base editor worker for JS/TS labels. */
export async function loadTsWorker(): Promise<{ new (): Worker } | null> {
  return null;
}
