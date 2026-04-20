/**
 * One-time Monaco initialization shared by every editor surface
 * (ScriptEditor, CodeEditor, CodeViewer). Monaco ships in
 * `node_modules/monaco-editor` via package.json — we do NOT fetch
 * anything over the network. We just tell `@monaco-editor/react`
 * to use the bundled copy instead of its default AMD bootstrap, and
 * wire the language workers to Vite-emitted Worker URLs:
 *   • `self.MonacoEnvironment.getWorker` returns local workers built
 *     from `monaco-editor/esm/vs/.../*.worker?worker`.
 *   • `loader.config({ monaco })` hands the pre-imported module to
 *     the React wrapper so it doesn't run its default loader script.
 *
 * Bundle discipline: we explicitly import ONLY the core editor +
 * the languages we use (js / ts / json / css / html / xml). The
 * default `monaco-editor` entry (`editor.main`) also pulls in every
 * built-in `basic-languages/*` contribution — azcli, bat, pla,
 * scheme, tcl, twenty more — turning what should be a lean bundle
 * into a 50 MB parse step on every Vite rebuild. `edcore.main`
 * skips the basic-languages bundle; we add back only the ones we
 * actually render.
 *
 * Module-load side effect: the bootstrap promise starts the moment
 * this file is imported, BEFORE any `<Editor>` mounts. If we kicked
 * it from a `useEffect`, the React wrapper would race ahead with its
 * own default loader (which hits an AMD bootstrap blocked by our CSP),
 * leaving the "Loading…" spinner stuck forever — which is exactly the
 * devpanel Response/Preview bug we hit on first integration.
 */

import { loader } from '@monaco-editor/react';
import * as monacoEdCore from 'monaco-editor/esm/vs/editor/edcore.main';
import 'monaco-editor/esm/vs/language/typescript/monaco.contribution';
import 'monaco-editor/esm/vs/language/json/monaco.contribution';
import 'monaco-editor/esm/vs/language/css/monaco.contribution';
import 'monaco-editor/esm/vs/language/html/monaco.contribution';
import 'monaco-editor/esm/vs/basic-languages/xml/xml.contribution';
import { javascriptDefaults, ScriptTarget } from 'monaco-editor/esm/vs/language/typescript/monaco.contribution';
import { OH_AMBIENT_DTS } from '../script-editor/oh-types';

let bootstrapPromise: Promise<void> | null = null;

function kickBootstrap(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    const [
      { default: EditorWorker },
      { default: TsWorker },
      { default: JsonWorker },
      { default: CssWorker },
      { default: HtmlWorker },
    ] = await Promise.all([
      import('monaco-editor/esm/vs/editor/editor.worker?worker'),
      import('monaco-editor/esm/vs/language/typescript/ts.worker?worker'),
      import('monaco-editor/esm/vs/language/json/json.worker?worker'),
      import('monaco-editor/esm/vs/language/css/css.worker?worker'),
      import('monaco-editor/esm/vs/language/html/html.worker?worker'),
    ]);

    self.MonacoEnvironment = {
      getWorker(_: string, label: string): Worker {
        if (label === 'typescript' || label === 'javascript') return new TsWorker();
        if (label === 'json') return new JsonWorker();
        if (label === 'css' || label === 'scss' || label === 'less') return new CssWorker();
        if (label === 'html' || label === 'handlebars' || label === 'razor') return new HtmlWorker();
        return new EditorWorker();
      },
    };

    loader.config({ monaco: monacoEdCore as unknown as Parameters<typeof loader.config>[0]['monaco'] });
    await loader.init();

    // Configure the TS language service for `oh.*` completions + hovers
    // in pre-request / post-response script editors. Harmless for other
    // languages — the declaration only kicks in when a model uses
    // javascript / typescript.
    javascriptDefaults.setCompilerOptions({
      target: ScriptTarget.ESNext,
      allowNonTsExtensions: true,
      lib: ['esnext', 'dom'],
      strict: true,
      noEmit: true,
    });
    javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    });
    javascriptDefaults.addExtraLib(OH_AMBIENT_DTS, 'ts:oh.d.ts');
  })();

  return bootstrapPromise;
}

// Module-load side effect: start the bootstrap immediately so
// `loader.config({ monaco })` wins the race against `<Editor>`'s
// internal `loader.init()`. The exported `ohMonacoReady` promise
// keeps the module from being tree-shaken — importers don't need
// to await it (the `<Editor>` wrapper waits on `loader.init` itself),
// but the export anchors the side effect.
export const ohMonacoReady: Promise<void> = kickBootstrap();
