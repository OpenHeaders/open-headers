// Monaco submodule imports used by the workbench editors. Monaco's
// `package.json` `exports` maps `./*`, so the `*.contribution` ESM
// paths resolve to Monaco's own shipped types — only the entries
// Monaco doesn't type need declaring here:
//
//   • `edcore.main` ships no `.d.ts`; it re-exports the top-level
//     Monaco API shape.
//   • `language/typescript/monaco.contribution` ships `export {}`,
//     so the `*Defaults` / `ScriptTarget` members the bootstrap reads
//     need augmenting on.
//   • `*.worker?worker` is a Vite query suffix Monaco knows nothing
//     about; the default export is a `Worker` constructor.
//
// Host apps that bundle `@openheaders/ui` carry the same shims for
// their own Monaco entry points (Vite supplies `*?worker` via
// `vite/client`).

declare module 'monaco-editor/esm/vs/editor/edcore.main' {
  export * from 'monaco-editor';
}

declare module 'monaco-editor/esm/vs/language/typescript/monaco.contribution' {
  import type * as Monaco from 'monaco-editor';
  export const javascriptDefaults: typeof Monaco.typescript.javascriptDefaults;
  export const typescriptDefaults: typeof Monaco.typescript.typescriptDefaults;
  export const ScriptTarget: typeof Monaco.typescript.ScriptTarget;
}

declare module 'monaco-editor/esm/vs/editor/editor.worker?worker' {
  const WorkerFactory: { new (): Worker };
  export default WorkerFactory;
}
declare module 'monaco-editor/esm/vs/language/typescript/ts.worker?worker' {
  const WorkerFactory: { new (): Worker };
  export default WorkerFactory;
}
declare module 'monaco-editor/esm/vs/language/json/json.worker?worker' {
  const WorkerFactory: { new (): Worker };
  export default WorkerFactory;
}
declare module 'monaco-editor/esm/vs/language/css/css.worker?worker' {
  const WorkerFactory: { new (): Worker };
  export default WorkerFactory;
}
declare module 'monaco-editor/esm/vs/language/html/html.worker?worker' {
  const WorkerFactory: { new (): Worker };
  export default WorkerFactory;
}
