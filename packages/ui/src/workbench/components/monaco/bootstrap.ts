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
 * Two-phase init:
 *   1. SYNC (module-load): theme definitions, JS language-service
 *      compiler options, + `oh.d.ts` ambient lib registration. These
 *      all operate on the monaco singleton that the namespace imports
 *      above already populated — no `loader.init()` dependency. Running
 *      them synchronously guarantees they are in place the moment any
 *      `<Editor>` component's internal `loader.init()` resolves, so
 *      the first editor mounts with a defined theme AND with `oh.*`
 *      already in the TS program (no race where tokens render
 *      uncolored because the theme isn't registered yet).
 *   2. ASYNC (bootstrap promise): worker-module imports + loader
 *      wiring. These MUST be async because the Worker imports are
 *      dynamic; that's fine because `<Editor>` awaits `loader.init()`
 *      internally and our bootstrap's `loader.init()` call is the one
 *      it's waiting for.
 */

import { loader } from '@monaco-editor/react';
import * as monacoEdCore from 'monaco-editor/esm/vs/editor/edcore.main';
// ── Language registrations ─────────────────────────────────────────
// Monaco splits "register the language ID + Monarch grammar" (in
// `basic-languages/<lang>/<lang>.contribution`) from "register the
// worker-backed language service" (in `language/<lang>/monaco.contribution`).
// For CSS / HTML / JS / TS the LSP contribution DOES NOT self-register
// the language — it waits for `languages.onLanguage('javascript', …)` to
// fire, which only happens after the basic-languages module has called
// `registerLanguage({ id: 'javascript', … })`. Without the basic-languages
// import the model renders as plaintext (no tokens, no completions) and
// the TS / CSS / HTML workers never spawn. JSON is the exception — its
// LSP contribution self-registers, which is why JSON body worked before.
//
// Keep the basic-languages imports FIRST so they register the language
// IDs before the LSP contributions install their `onLanguage` callbacks.
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution';
import 'monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution';
import 'monaco-editor/esm/vs/basic-languages/css/css.contribution';
import 'monaco-editor/esm/vs/basic-languages/html/html.contribution';
import 'monaco-editor/esm/vs/basic-languages/xml/xml.contribution';
import 'monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution';
// LSP contributions — JSON / CSS / HTML workers + semantic features. The
// TS/JS language service lives in `./ts-language-service` so the Firefox
// build can alias it to a no-op stub: its `ts.worker` (the bundled TS
// compiler, ~8 MB) exceeds Firefox add-on validation's 5 MB per-file limit.
import 'monaco-editor/esm/vs/language/json/monaco.contribution';
import 'monaco-editor/esm/vs/language/css/monaco.contribution';
import 'monaco-editor/esm/vs/language/html/monaco.contribution';
import { allVariants } from '@openheaders/ui/themes';
import { type ChromeHoverOptions, HoverService } from 'monaco-editor/esm/vs/platform/hover/browser/hoverService';
import { registerPrettierFormatters } from './formatters';
import { configureTsLanguageService, loadTsWorker } from './ts-language-service';

// ── Phase 1: synchronous monaco-singleton configuration ──────────
//
// `monacoEdCore.editor.defineTheme` and `javascriptDefaults.*` mutate
// the singleton registries populated by the contribution imports
// above. They work at module-load time — no need to wait for
// `loader.init()`. Running them synchronously lets the Editor
// component mount with a fully-configured singleton.

// Register one Monaco theme per variant from the themes registry. Each
// variant ships its own `monacoTheme` id + definition; ConfigProvider
// and the editor surfaces both read the active variant from the same
// registry, so the chrome and the editor stay in sync.
for (const variant of allVariants()) {
  monacoEdCore.editor.defineTheme(variant.monacoTheme, variant.monacoDefinition);
}

// JS/TS language-service configuration (compiler options, diagnostics,
// ambient `oh.*` lib) for every JS-flavored editor. No-op on Firefox,
// where `./ts-language-service` resolves to the stub.
configureTsLanguageService();

// Register Prettier as Monaco's `DocumentFormattingEditProvider` for
// languages Monaco has no built-in formatter for (JS / XML). JSON /
// CSS / HTML use Monaco's built-in LSP formatters — no registration
// needed. Every Format button + Shift+Alt+F invocation funnels through
// `editor.action.formatDocument`, which dispatches to whichever
// provider owns the model's language.
registerPrettierFormatters(monacoEdCore as unknown as typeof import('monaco-editor'));

// Monaco's chrome tooltips (find-widget buttons, Aa / ab / .* input
// toggles) default to ABOVE the control. The find widget sits at the
// editor's top edge, so those hovers land outside the editor box where
// the host wrapper's `overflow: hidden` clips them. No editor option
// covers these hovers (`hover.above` only affects code-content hovers),
// so a BELOW default is injected at the hover-service seam; callers
// that pass an explicit position keep it. Code-content hovers render
// through the editor hover contrib and are unaffected.
const HOVER_POSITION_BELOW = 2;
function withBelowDefault(options: ChromeHoverOptions): ChromeHoverOptions {
  return options.position === undefined ? { ...options, position: { hoverPosition: HOVER_POSITION_BELOW } } : options;
}
const hoverProto = HoverService.prototype;
const originalShowInstantHover = hoverProto.showInstantHover;
hoverProto.showInstantHover = function (this: HoverService, options, focus, skipLastFocusedUpdate, dontShow) {
  return originalShowInstantHover.call(this, withBelowDefault(options), focus, skipLastFocusedUpdate, dontShow);
};
const originalShowDelayedHover = hoverProto.showDelayedHover;
hoverProto.showDelayedHover = function (this: HoverService, options, lifecycleOptions) {
  return originalShowDelayedHover.call(this, withBelowDefault(options), lifecycleOptions);
};

// ── Phase 2: synchronous loader configuration ────────────────────
//
// This MUST run at module-load time — before any `<Editor>` has a
// chance to mount. `@monaco-editor/react`'s default loader fetches
// `loader.js` from jsdelivr CDN; our CSP (`script-src 'self'`) blocks
// that, and the editor hangs on a skeleton / "Loading..." forever.
// Handing the loader the pre-imported `monacoEdCore` singleton here
// tells it "use this, don't fetch anything". The call is synchronous,
// so every Editor rendered after this module is imported is safe —
// even when the whole bootstrap is reached via `React.lazy` and the
// first Editor paints milliseconds after the dynamic import resolves.
loader.config({ monaco: monacoEdCore as unknown as Parameters<typeof loader.config>[0]['monaco'] });

// ── Phase 3: async worker wiring ─────────────────────────────────

let bootstrapPromise: Promise<void> | null = null;

function kickBootstrap(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    const [
      { default: EditorWorker },
      { default: JsonWorker },
      { default: CssWorker },
      { default: HtmlWorker },
      TsWorker,
    ] = await Promise.all([
      import('monaco-editor/esm/vs/editor/editor.worker?worker'),
      import('monaco-editor/esm/vs/language/json/json.worker?worker'),
      import('monaco-editor/esm/vs/language/css/css.worker?worker'),
      import('monaco-editor/esm/vs/language/html/html.worker?worker'),
      // Resolves to the TS worker constructor — or `null` on Firefox,
      // where the language service is stubbed out (see ./ts-language-service).
      loadTsWorker(),
    ]);

    self.MonacoEnvironment = {
      getWorker(_: string, label: string): Worker {
        if ((label === 'typescript' || label === 'javascript') && TsWorker) return new TsWorker();
        if (label === 'json') return new JsonWorker();
        if (label === 'css' || label === 'scss' || label === 'less') return new CssWorker();
        if (label === 'html' || label === 'handlebars' || label === 'razor') return new HtmlWorker();
        return new EditorWorker();
      },
    };

    await loader.init();
  })();

  return bootstrapPromise;
}

// Module-load side effect: start the async worker bootstrap immediately
// so `<Editor>`'s internal `await loader.init()` resolves against our
// pre-configured loader (workers ready, CDN fetch avoided).
export const ohMonacoReady: Promise<void> = kickBootstrap();
