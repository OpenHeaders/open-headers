/**
 * Monaco TS/JS language service — the heavy half of the editor bootstrap,
 * isolated so the Firefox build can swap it for a no-op stub (see
 * `ts-language-service.firefox.ts`).
 *
 * Importing this module pulls in Monaco's `language/typescript`
 * contribution, which registers the worker-backed language service
 * (semantic completions, diagnostics, hover types) and drags the TS
 * compiler plus the bundled `lib.*.d.ts` into the build as `ts.worker`
 * (~8 MB). Firefox add-on validation rejects any single file over 5 MB,
 * so the Firefox build aliases this module to the stub: editors keep
 * JS/TS syntax highlighting (the lightweight `basic-languages` tokenizers
 * imported by `bootstrap.ts`) but lose the language service.
 */

import {
  javascriptDefaults,
  ScriptTarget,
  typescriptDefaults,
} from 'monaco-editor/esm/vs/language/typescript/monaco.contribution';
import { OH_AMBIENT_DTS } from '../script-editor/oh-types';

// `allowNonTsExtensions: true` + `allowJs: true` let inmemory JS models
// participate in the TS program alongside the ambient lib.
const JS_COMPILER_OPTIONS = {
  target: ScriptTarget.ESNext,
  allowNonTsExtensions: true,
  allowJs: true,
  lib: ['esnext', 'dom'],
  strict: false,
  noEmit: true,
};
const JS_DIAGNOSTICS_OPTIONS = {
  noSemanticValidation: false,
  noSyntaxValidation: false,
  // Silence top-level-await diagnostics (1375 / 1378) — the script
  // sandbox wraps user source in an async function, so
  // `await oh.variables.get(...)` at the top level is fine.
  diagnosticCodesToIgnore: [1375, 1378],
};

/**
 * Configure the JS/TS language service for every JS-flavored editor in
 * the app (scripts tab, raw-JavaScript body, …): compiler options,
 * diagnostics, and the ambient `oh.*` declaration. Runs synchronously at
 * bootstrap module-load so the first editor mounts with `oh.*` already in
 * the TS program (no race where tokens render before the lib registers).
 */
export function configureTsLanguageService(): void {
  javascriptDefaults.setCompilerOptions(JS_COMPILER_OPTIONS);
  javascriptDefaults.setDiagnosticsOptions(JS_DIAGNOSTICS_OPTIONS);
  // Applied to `typescriptDefaults` too so a user who ever points an
  // editor at `language="typescript"` still sees `oh.*`. Same ambient
  // file path keys the same lib slot in both services.
  typescriptDefaults.setCompilerOptions(JS_COMPILER_OPTIONS);
  typescriptDefaults.setDiagnosticsOptions(JS_DIAGNOSTICS_OPTIONS);
  // `file:///oh.d.ts` uses the `file` scheme Monaco auto-assigns to
  // anonymous models so the declaration and the user's model share a
  // program. Ambient `declare const oh: {…}` → visible globally in every
  // JS / TS model.
  javascriptDefaults.addExtraLib(OH_AMBIENT_DTS, 'file:///oh.d.ts');
  typescriptDefaults.addExtraLib(OH_AMBIENT_DTS, 'file:///oh.d.ts');
}

/**
 * Dynamically import the TS language worker (the ~8 MB compiler bundle).
 * Kept dynamic so it lands in its own chunk rather than the main editor
 * payload. Returns the `Worker` constructor for `MonacoEnvironment`.
 */
export async function loadTsWorker(): Promise<{ new (): Worker } | null> {
  const { default: TsWorker } = await import('monaco-editor/esm/vs/language/typescript/ts.worker?worker');
  return TsWorker;
}
