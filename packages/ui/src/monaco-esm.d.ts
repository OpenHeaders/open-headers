// Monaco submodule imports used by the merge-editor. Monaco's
// `package.json` ships types only for the default `editor.main` entry,
// so TypeScript can't resolve the leaner `edcore.main` ESM path without
// this declaration — it re-exports the same top-level Monaco API shape.
// Host apps that bundle `@openheaders/ui` carry the same shim for their
// own Monaco entry points.

declare module 'monaco-editor/esm/vs/editor/edcore.main' {
  export * from 'monaco-editor';
}
