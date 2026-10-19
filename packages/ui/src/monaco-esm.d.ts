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

declare module 'monaco-editor/esm/vs/language/json/monaco.contribution' {
  import type * as Monaco from 'monaco-editor';
  export const jsonDefaults: typeof Monaco.json.jsonDefaults;
  /** An LSP diagnostic as the JSON worker answers it. */
  export interface JsonWorkerDiagnostic {
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
    message: string;
    severity?: number;
    code?: number | string;
    source?: string;
  }
  /** The worker behind the accessor. The published `IJSONWorker`
   *  narrows it to the document queries; the proxy forwards every
   *  method of the worker class (it is a `Proxy` with a `get` trap
   *  only, so no `in` check can see them), and the contribution's own
   *  diagnostics provider calls `doValidation` over this accessor. */
  export interface JsonWorker extends Monaco.json.IJSONWorker {
    doValidation(uri: string): Promise<JsonWorkerDiagnostic[]>;
  }
  export const getWorker: () => Promise<(...uris: Monaco.Uri[]) => Promise<JsonWorker>>;
}

declare module 'monaco-editor/esm/vs/platform/hover/browser/hoverService' {
  // Minimal surface of the chrome-tooltip hover service (find-widget
  // buttons, input toggles). Only the members the bootstrap's position
  // patch touches; extra runtime fields pass through untouched.
  export interface ChromeHoverOptions {
    position?: { hoverPosition?: number };
  }
  export class HoverService {
    showInstantHover(
      options: ChromeHoverOptions,
      focus?: boolean,
      skipLastFocusedUpdate?: boolean,
      dontShow?: boolean,
    ): unknown;
    showDelayedHover(options: ChromeHoverOptions, lifecycleOptions?: { groupId?: string }): unknown;
  }
}

declare module 'monaco-editor/esm/vs/editor/standalone/browser/standaloneServices' {
  // Minimal surface of the standalone service locator. A service id is
  // the decorator `createDecorator` returns; only its phantom type is
  // needed to type the lookup.
  export interface ServiceIdentifier<T> {
    readonly type: T;
  }
  export namespace StandaloneServices {
    function get<T>(serviceId: ServiceIdentifier<T>): T;
  }
}

declare module 'monaco-editor/esm/vs/editor/common/services/languageFeatures' {
  import type * as Monaco from 'monaco-editor';
  import type { ServiceIdentifier } from 'monaco-editor/esm/vs/editor/standalone/browser/standaloneServices';
  // Minimal surface of a language-feature registry: `onDidChange` fires
  // synchronously on every `register` and on every disposal.
  export interface LanguageFeatureRegistry {
    onDidChange(listener: (count: number) => void): Monaco.IDisposable;
  }
  // Only the registry the JSON mode readiness watches.
  export interface LanguageFeaturesService {
    readonly documentFormattingEditProvider: LanguageFeatureRegistry;
  }
  export const ILanguageFeaturesService: ServiceIdentifier<LanguageFeaturesService>;
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
