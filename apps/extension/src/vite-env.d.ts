/// <reference types="vite/client" />

/** Build-time constant injected by Vite from package.json version. */
declare const __APP_VERSION__: string;

/**
 * Build metadata injected by Vite at build time. See `vite.config.ts`
 * (`buildInfo` constant) and `src/shared/build-info.ts` for the typed
 * accessor consumers should use.
 */
declare const __BUILD_INFO__: {
  version: string;
  commit: string;
  commitFull: string;
  build: number;
  date: string;
  channel: 'stable' | 'beta';
};

// Monaco submodule imports we use to keep the bundle lean (see
// `rules/components/monaco/bootstrap.ts`). Monaco's `package.json`
// `exports` field maps `./*` but only ships types for the default
// `editor.main` entry, so TypeScript can't resolve the submodule
// paths without these declarations. All of them re-export the same
// top-level Monaco API shape (or are pure side-effect registrations).

declare module 'monaco-editor/esm/vs/editor/edcore.main' {
  export * from 'monaco-editor';
}
declare module 'monaco-editor/esm/vs/language/typescript/monaco.contribution' {
  import type * as Monaco from 'monaco-editor';
  export const javascriptDefaults: typeof Monaco.typescript.javascriptDefaults;
  export const typescriptDefaults: typeof Monaco.typescript.typescriptDefaults;
  export const ScriptTarget: typeof Monaco.typescript.ScriptTarget;
}
declare module 'monaco-editor/esm/vs/language/json/monaco.contribution';
declare module 'monaco-editor/esm/vs/language/css/monaco.contribution';
declare module 'monaco-editor/esm/vs/language/html/monaco.contribution';
declare module 'monaco-editor/esm/vs/basic-languages/xml/xml.contribution';
