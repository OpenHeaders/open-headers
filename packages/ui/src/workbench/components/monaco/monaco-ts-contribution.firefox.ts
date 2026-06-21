/**
 * Firefox stub for Monaco's `language/typescript` contribution.
 *
 * Monaco's full editor entry (`editor.main`) side-effect-imports this
 * contribution, which registers the TS/JS language service and — via its
 * `tsMode`/`workerManager` — does `new Worker(new URL('./ts.worker', …))`.
 * Vite bundles that worker (the TS compiler + `lib.*.d.ts`, ~8 MB) from
 * the `new Worker(new URL(...))` reference regardless of our own imports.
 * Firefox add-on validation rejects any single file over 5 MB.
 *
 * The Firefox build aliases the contribution to this empty module (see
 * the extension's `vite.config.ts`), so `editor.main` registers no TS
 * language service and the worker is never referenced. Firefox keeps
 * TS/JS syntax highlighting via the `basic-languages` tokenizers in
 * `bootstrap.ts`; only the worker-backed language service is dropped.
 * Chrome/Edge/Safari are untouched and keep the full service.
 */

export {};
