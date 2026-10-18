/**
 * json-diagnostics — ONE validator plane for every JSON buffer, with
 * Monaco's JSON worker as its engine.
 *
 * The contribution's own diagnostics provider validates each `json`
 * model's raw text and publishes its markers on that model. A body
 * editor with the variable plane needs its text validated with every
 * `{{ref}}` read as a value, which only a stand-in buffer can carry;
 * mirroring the stand-in's markers over the provider's would race it:
 * the marker service's event is a debounced emitter (delay 0), every
 * delivery lands a macrotask later, and the editor's marker
 * decorations subscribe ahead of any later listener — so the raw set
 * paints whenever a frame falls between the provider's publish and
 * the re-assert. Hence the provider is switched off through its mode
 * configuration and this plane publishes for every JSON model: the
 * model's own text by default, a stand-in's when one is attached
 * through {@link attachJsonStandIn}. The worker reads text by uri from
 * its synced mirror models and never by language, so a stand-in may
 * be any model the model service knows.
 *
 * The lifecycle is the provider's own: a model enters when it is
 * created as `json` or switches to it, leaves on dispose or on
 * switching away (markers cleared), revalidates 500 ms after its
 * source's last content change and when the defaults change. A result
 * publishes only while the entry and its source are the ones that
 * asked, so a late answer never lands on a replaced source.
 */

import type * as monaco from 'monaco-editor';

export const JSON_DIAGNOSTICS_OWNER = 'openheaders-json';
export const JSON_LANGUAGE_ID = 'json';
/** The contribution's own debounce after a content change. */
export const JSON_VALIDATE_DELAY_MS = 500;

/** The slice of a text model the plane reads. */
export interface JsonDiagnosticsModel {
  readonly uri: monaco.Uri;
  getLanguageId(): string;
  onDidChangeContent(listener: () => void): monaco.IDisposable;
  isDisposed(): boolean;
}

/** The slice of the Monaco namespace the plane drives, plus the JSON
 *  contribution's exports — the lean `edcore` entry never attaches the
 *  contribution to `languages.json`, so its module hands them over. */
export interface JsonDiagnosticsHost {
  editor: {
    onDidCreateModel(listener: (model: JsonDiagnosticsModel) => void): monaco.IDisposable;
    onWillDisposeModel(listener: (model: JsonDiagnosticsModel) => void): monaco.IDisposable;
    onDidChangeModelLanguage(listener: (e: { readonly model: JsonDiagnosticsModel }) => void): monaco.IDisposable;
    getModels(): readonly JsonDiagnosticsModel[];
    setModelMarkers(model: JsonDiagnosticsModel, owner: string, markers: monaco.editor.IMarkerData[]): void;
  };
  json: {
    jsonDefaults: {
      readonly modeConfiguration: monaco.json.ModeConfiguration;
      setModeConfiguration(modeConfiguration: monaco.json.ModeConfiguration): void;
      onDidChange(listener: () => void): monaco.IDisposable;
    };
    getWorker(): Promise<(...uris: monaco.Uri[]) => Promise<JsonValidationWorker>>;
  };
  MarkerSeverity: typeof monaco.MarkerSeverity;
}

/** An LSP diagnostic as the JSON worker answers it. */
export interface LspDiagnostic {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  message: string;
  severity?: number;
  code?: number | string;
  source?: string;
}

/** The worker method the contribution's own provider calls over the
 *  same accessor (the contribution module's shim types the proxy with
 *  it — the published worker type lists only the document queries). */
export interface JsonValidationWorker {
  doValidation(uri: string): Promise<readonly LspDiagnostic[]>;
}

const LSP_SEVERITY_ERROR = 1;
const LSP_SEVERITY_WARNING = 2;
const LSP_SEVERITY_HINT = 4;

function toMarkerSeverity(severity: typeof monaco.MarkerSeverity, lsp: number | undefined): monaco.MarkerSeverity {
  switch (lsp) {
    case LSP_SEVERITY_ERROR:
      return severity.Error;
    case LSP_SEVERITY_WARNING:
      return severity.Warning;
    case LSP_SEVERITY_HINT:
      return severity.Hint;
    default:
      return severity.Info;
  }
}

/** The provider's own conversion — one-based positions, a string code. */
export function toMarkerData(
  severity: typeof monaco.MarkerSeverity,
  diagnostic: LspDiagnostic,
): monaco.editor.IMarkerData {
  return {
    severity: toMarkerSeverity(severity, diagnostic.severity),
    startLineNumber: diagnostic.range.start.line + 1,
    startColumn: diagnostic.range.start.character + 1,
    endLineNumber: diagnostic.range.end.line + 1,
    endColumn: diagnostic.range.end.character + 1,
    message: diagnostic.message,
    ...(diagnostic.code !== undefined ? { code: String(diagnostic.code) } : {}),
    ...(diagnostic.source !== undefined ? { source: diagnostic.source } : {}),
  };
}

interface Entry {
  readonly model: JsonDiagnosticsModel;
  /** The model whose text the worker validates — the model itself, or
   *  its stand-in. */
  source: JsonDiagnosticsModel;
  subscription: monaco.IDisposable;
  handle: ReturnType<typeof setTimeout> | null;
  /** Bumped by every validation and removal, so a late answer can tell
   *  it is stale. */
  generation: number;
}

let host: JsonDiagnosticsHost | null = null;
let hostSubscriptions: monaco.IDisposable[] = [];
const entries = new Map<string, Entry>();

function keyOf(model: JsonDiagnosticsModel): string {
  return model.uri.toString();
}

function validate(entry: Entry): void {
  const api = host;
  if (!api) return;
  const generation = ++entry.generation;
  const { source } = entry;
  api.json
    .getWorker()
    .then((accessor) => accessor(source.uri))
    .then((worker) => worker.doValidation(source.uri.toString()))
    .then((diagnostics) => {
      if (entry.generation !== generation || entries.get(keyOf(entry.model)) !== entry) return;
      if (entry.model.isDisposed()) return;
      api.editor.setModelMarkers(
        entry.model,
        JSON_DIAGNOSTICS_OWNER,
        diagnostics.map((diagnostic) => toMarkerData(api.MarkerSeverity, diagnostic)),
      );
    })
    .catch((err: unknown) => {
      console.error(err);
    });
}

function schedule(entry: Entry): void {
  if (entry.handle !== null) clearTimeout(entry.handle);
  entry.handle = setTimeout(() => {
    entry.handle = null;
    validate(entry);
  }, JSON_VALIDATE_DELAY_MS);
}

function watch(entry: Entry, source: JsonDiagnosticsModel): void {
  entry.subscription.dispose();
  if (entry.handle !== null) {
    clearTimeout(entry.handle);
    entry.handle = null;
  }
  entry.source = source;
  entry.subscription = source.onDidChangeContent(() => schedule(entry));
  validate(entry);
}

function add(model: JsonDiagnosticsModel): void {
  if (model.getLanguageId() !== JSON_LANGUAGE_ID) return;
  const key = keyOf(model);
  if (entries.has(key)) return;
  const entry: Entry = { model, source: model, subscription: { dispose: () => {} }, handle: null, generation: 0 };
  entries.set(key, entry);
  watch(entry, model);
}

function remove(model: JsonDiagnosticsModel): void {
  const key = keyOf(model);
  const entry = entries.get(key);
  if (!entry) return;
  entries.delete(key);
  entry.generation++;
  entry.subscription.dispose();
  if (entry.handle !== null) clearTimeout(entry.handle);
  if (host && !model.isDisposed()) host.editor.setModelMarkers(model, JSON_DIAGNOSTICS_OWNER, []);
}

/** A stand-in about to go: the models validating through it return to
 *  their own text. */
function releaseStandIn(standIn: JsonDiagnosticsModel): void {
  for (const entry of entries.values()) {
    if (entry.source === standIn && entry.source !== entry.model) watch(entry, entry.model);
  }
}

/**
 * Install the plane once, in the bootstrap's synchronous phase, before
 * any JSON model exists: the contribution's provider off, this plane
 * on for every current and future `json` model.
 */
export function registerJsonDiagnostics(api: JsonDiagnosticsHost): void {
  if (host) return;
  host = api;
  const { jsonDefaults } = api.json;
  jsonDefaults.setModeConfiguration({ ...jsonDefaults.modeConfiguration, diagnostics: false });
  hostSubscriptions = [
    api.editor.onDidCreateModel(add),
    api.editor.onWillDisposeModel((model) => {
      releaseStandIn(model);
      remove(model);
    }),
    api.editor.onDidChangeModelLanguage(({ model }) => {
      remove(model);
      add(model);
    }),
    jsonDefaults.onDidChange(() => {
      for (const entry of entries.values()) validate(entry);
    }),
  ];
  for (const model of api.editor.getModels()) add(model);
}

/** Uninstall the plane: every held model's markers cleared, the
 *  contribution's provider back on. */
export function disposeJsonDiagnostics(): void {
  const api = host;
  if (!api) return;
  for (const entry of [...entries.values()]) remove(entry.model);
  for (const subscription of hostSubscriptions) subscription.dispose();
  hostSubscriptions = [];
  const { jsonDefaults } = api.json;
  jsonDefaults.setModeConfiguration({ ...jsonDefaults.modeConfiguration, diagnostics: true });
  host = null;
}

/**
 * Validate `model` through `standIn`'s text — its markers land on
 * `model`. Disposing returns the model to its own text. A model the
 * plane does not hold (not `json`, or the plane not installed) takes
 * no stand-in.
 */
export function attachJsonStandIn(model: JsonDiagnosticsModel, standIn: JsonDiagnosticsModel): monaco.IDisposable {
  const entry = entries.get(keyOf(model));
  if (!entry) return { dispose: () => {} };
  watch(entry, standIn);
  return {
    dispose: () => {
      if (entries.get(keyOf(model)) === entry && entry.source === standIn) watch(entry, entry.model);
    },
  };
}
