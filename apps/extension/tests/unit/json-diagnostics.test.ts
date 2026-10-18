/**
 * The JSON diagnostics plane — the one publisher of the worker's
 * markers for every JSON model, against a fake namespace and a fake
 * worker. No Monaco runs.
 *
 * Contract: installing switches the contribution's provider off and
 * validates every JSON model; a model validates on create and 500 ms
 * after its last content change; a plaintext model is never asked; a
 * language change clears and re-enters; a dispose clears; a stand-in
 * is what the worker reads while its markers land on the model, and
 * its lease returns the model to its own text; a late answer from a
 * replaced source never lands; a worker without validation publishes
 * nothing and says so once.
 */

import {
  attachJsonStandIn,
  disposeJsonDiagnostics,
  JSON_DIAGNOSTICS_OWNER,
  JSON_VALIDATE_DELAY_MS,
  type JsonDiagnosticsHost,
  type JsonDiagnosticsModel,
  type LspDiagnostic,
  registerJsonDiagnostics,
  toMarkerData,
} from '@openheaders/ui/workbench/components/monaco/json-diagnostics';
import type * as monaco from 'monaco-editor';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Listener<T> = (e: T) => void;

class Emitter<T> {
  private readonly listeners = new Set<Listener<T>>();
  readonly on = (listener: Listener<T>) => {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  };
  fire(e: T): void {
    for (const listener of this.listeners) listener(e);
  }
}

const SEVERITY = { Hint: 1, Info: 2, Warning: 4, Error: 8 } as unknown as typeof monaco.MarkerSeverity;

interface FakeModel extends JsonDiagnosticsModel {
  setLanguage(language: string): void;
  edit(): void;
  dispose(): void;
}

function diagnostic(message: string, line = 0): LspDiagnostic {
  return { range: { start: { line, character: 2 }, end: { line, character: 5 } }, message, severity: 1 };
}

function fakeHost() {
  const created = new Emitter<JsonDiagnosticsModel>();
  const willDispose = new Emitter<JsonDiagnosticsModel>();
  const languageChanged = new Emitter<{ model: JsonDiagnosticsModel }>();
  const defaultsChanged = new Emitter<void>();
  const models: FakeModel[] = [];
  const setModelMarkers =
    vi.fn<(model: JsonDiagnosticsModel, owner: string, markers: monaco.editor.IMarkerData[]) => void>();
  const answers = new Map<string, LspDiagnostic[]>();
  const pending = new Map<string, Array<(diagnostics: LspDiagnostic[]) => void>>();
  const asked: string[] = [];
  const doValidation = vi.fn(
    (uri: string) =>
      new Promise<LspDiagnostic[]>((resolve) => {
        asked.push(uri);
        const waiting = pending.get(uri);
        if (waiting) waiting.push(resolve);
        else resolve(answers.get(uri) ?? []);
      }),
  );
  let worker: object = { doValidation };
  const getWorker = vi.fn(async () => async () => worker);
  let modeConfiguration: monaco.json.ModeConfiguration = { diagnostics: true, tokens: true };
  const setModeConfiguration = vi.fn((next: monaco.json.ModeConfiguration) => {
    modeConfiguration = next;
  });
  const host: JsonDiagnosticsHost = {
    editor: {
      onDidCreateModel: created.on,
      onWillDisposeModel: willDispose.on,
      onDidChangeModelLanguage: languageChanged.on,
      getModels: () => models,
      setModelMarkers,
    },
    json: {
      jsonDefaults: {
        get modeConfiguration() {
          return modeConfiguration;
        },
        setModeConfiguration,
        onDidChange: defaultsChanged.on,
      },
      getWorker,
    },
    MarkerSeverity: SEVERITY,
  };
  function model(path: string, language: string, { create = true } = {}): FakeModel {
    const content = new Emitter<void>();
    let disposed = false;
    const uri = { toString: () => `inmemory://model${path}` } as unknown as monaco.Uri;
    const fake: FakeModel = {
      uri,
      getLanguageId: () => language,
      onDidChangeContent: (listener) => content.on(listener),
      isDisposed: () => disposed,
      setLanguage(next) {
        language = next;
        languageChanged.fire({ model: fake });
      },
      edit: () => content.fire(),
      dispose() {
        willDispose.fire(fake);
        disposed = true;
        models.splice(models.indexOf(fake), 1);
      },
    };
    models.push(fake);
    if (create) created.fire(fake);
    return fake;
  }
  return {
    host,
    model,
    asked,
    answers,
    setModelMarkers,
    setModeConfiguration,
    modeConfiguration: () => modeConfiguration,
    defaultsChanged,
    /** Hold the next answers for `uri` until released. */
    hold(uri: string) {
      const waiting: Array<(diagnostics: LspDiagnostic[]) => void> = [];
      pending.set(uri, waiting);
      return (diagnostics: LspDiagnostic[]) => {
        pending.delete(uri);
        for (const resolve of waiting) resolve(diagnostics);
      };
    },
    setWorker(next: object) {
      worker = next;
    },
  };
}

const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  disposeJsonDiagnostics();
  vi.useRealTimers();
});

describe('registerJsonDiagnostics', () => {
  it('switches the contribution’s provider off and validates the JSON models already there, never a plaintext one', async () => {
    const h = fakeHost();
    const json = h.model('/1', 'json', { create: false });
    h.model('/2', 'plaintext', { create: false });
    h.answers.set(json.uri.toString(), [diagnostic('Property expected')]);
    registerJsonDiagnostics(h.host);
    expect(h.setModeConfiguration).toHaveBeenCalledTimes(1);
    expect(h.modeConfiguration()).toEqual({ diagnostics: false, tokens: true });
    await flush();
    expect(h.asked).toEqual([json.uri.toString()]);
    expect(h.setModelMarkers).toHaveBeenCalledTimes(1);
    const [target, owner, markers] = h.setModelMarkers.mock.calls[0];
    expect(target).toBe(json);
    expect(owner).toBe(JSON_DIAGNOSTICS_OWNER);
    expect(markers).toEqual([
      { severity: 8, startLineNumber: 1, startColumn: 3, endLineNumber: 1, endColumn: 6, message: 'Property expected' },
    ]);
  });

  it('validates a created JSON model at once and again 500 ms after its last edit', async () => {
    const h = fakeHost();
    registerJsonDiagnostics(h.host);
    const json = h.model('/1', 'json');
    await flush();
    expect(h.asked).toEqual([json.uri.toString()]);
    json.edit();
    await vi.advanceTimersByTimeAsync(JSON_VALIDATE_DELAY_MS - 1);
    json.edit();
    await vi.advanceTimersByTimeAsync(JSON_VALIDATE_DELAY_MS - 1);
    expect(h.asked).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(h.asked).toHaveLength(2);
  });

  it('clears a model that leaves JSON and re-enters one that comes back', async () => {
    const h = fakeHost();
    registerJsonDiagnostics(h.host);
    const json = h.model('/1', 'json');
    await flush();
    h.setModelMarkers.mockClear();
    json.setLanguage('plaintext');
    expect(h.setModelMarkers).toHaveBeenCalledWith(json, JSON_DIAGNOSTICS_OWNER, []);
    json.edit();
    await vi.advanceTimersByTimeAsync(JSON_VALIDATE_DELAY_MS);
    expect(h.asked).toHaveLength(1);
    json.setLanguage('json');
    await flush();
    expect(h.asked).toHaveLength(2);
  });

  it('clears a disposed model and drops its pending validation', async () => {
    const h = fakeHost();
    registerJsonDiagnostics(h.host);
    const json = h.model('/1', 'json');
    await flush();
    json.edit();
    h.setModelMarkers.mockClear();
    json.dispose();
    expect(h.setModelMarkers).toHaveBeenCalledWith(json, JSON_DIAGNOSTICS_OWNER, []);
    await vi.advanceTimersByTimeAsync(JSON_VALIDATE_DELAY_MS);
    expect(h.asked).toHaveLength(1);
  });

  it('revalidates every held model when the defaults change', async () => {
    const h = fakeHost();
    registerJsonDiagnostics(h.host);
    h.model('/1', 'json');
    h.model('/2', 'json');
    await flush();
    h.defaultsChanged.fire();
    await flush();
    expect(h.asked).toHaveLength(4);
  });

  it('publishes nothing and reports once when the worker has no validation', async () => {
    const h = fakeHost();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    h.setWorker({});
    registerJsonDiagnostics(h.host);
    h.model('/1', 'json');
    h.model('/2', 'json');
    await flush();
    expect(h.setModelMarkers).toHaveBeenCalledTimes(2);
    expect(h.setModelMarkers.mock.calls.every(([, , markers]) => markers.length === 0)).toBe(true);
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });
});

describe('attachJsonStandIn', () => {
  it('asks the worker for the stand-in’s text and lands the markers on the model', async () => {
    const h = fakeHost();
    registerJsonDiagnostics(h.host);
    const real = h.model('/1', 'json');
    const shadow = h.model('/shadow/1', 'plaintext');
    await flush();
    h.answers.set(shadow.uri.toString(), [diagnostic('Expected comma', 3)]);
    h.setModelMarkers.mockClear();
    const lease = attachJsonStandIn(real, shadow);
    await flush();
    expect(h.asked.at(-1)).toBe(shadow.uri.toString());
    expect(h.setModelMarkers).toHaveBeenCalledTimes(1);
    expect(h.setModelMarkers.mock.calls[0][0]).toBe(real);
    expect(h.setModelMarkers.mock.calls[0][2][0].startLineNumber).toBe(4);
    // The stand-in's edits drive the debounce now; the model's own do not.
    const askedBefore = h.asked.length;
    real.edit();
    await vi.advanceTimersByTimeAsync(JSON_VALIDATE_DELAY_MS);
    expect(h.asked).toHaveLength(askedBefore);
    shadow.edit();
    await vi.advanceTimersByTimeAsync(JSON_VALIDATE_DELAY_MS);
    expect(h.asked).toHaveLength(askedBefore + 1);
    expect(h.asked.at(-1)).toBe(shadow.uri.toString());
    lease.dispose();
    await flush();
    expect(h.asked.at(-1)).toBe(real.uri.toString());
  });

  it('drops the model’s own answer that was in flight when the stand-in took over', async () => {
    const h = fakeHost();
    registerJsonDiagnostics(h.host);
    const real = h.model('/1', 'json', { create: false });
    const shadow = h.model('/shadow/1', 'plaintext', { create: false });
    const releaseReal = h.hold(real.uri.toString());
    real.setLanguage('json');
    await flush();
    expect(h.asked).toEqual([real.uri.toString()]);
    h.answers.set(shadow.uri.toString(), [diagnostic('from the shadow')]);
    attachJsonStandIn(real, shadow);
    await flush();
    releaseReal([diagnostic('from the raw text')]);
    await flush();
    const messages = h.setModelMarkers.mock.calls.map(([, , markers]) => markers.map((m) => m.message));
    expect(messages).toEqual([['from the shadow']]);
  });

  it('returns the model to its own text when the stand-in is disposed first', async () => {
    const h = fakeHost();
    registerJsonDiagnostics(h.host);
    const real = h.model('/1', 'json');
    const shadow = h.model('/shadow/1', 'plaintext');
    await flush();
    attachJsonStandIn(real, shadow);
    await flush();
    shadow.dispose();
    await flush();
    expect(h.asked.at(-1)).toBe(real.uri.toString());
  });

  it('takes no stand-in for a model the plane does not hold', () => {
    const h = fakeHost();
    registerJsonDiagnostics(h.host);
    const text = h.model('/1', 'plaintext');
    const shadow = h.model('/shadow/1', 'plaintext');
    const asked = h.asked.length;
    attachJsonStandIn(text, shadow).dispose();
    expect(h.asked).toHaveLength(asked);
  });
});

describe('disposeJsonDiagnostics', () => {
  it('clears every held model, restores the provider, and ignores later models', async () => {
    const h = fakeHost();
    registerJsonDiagnostics(h.host);
    const json = h.model('/1', 'json');
    await flush();
    h.setModelMarkers.mockClear();
    disposeJsonDiagnostics();
    expect(h.setModelMarkers).toHaveBeenCalledWith(json, JSON_DIAGNOSTICS_OWNER, []);
    expect(h.modeConfiguration()).toEqual({ diagnostics: true, tokens: true });
    h.model('/2', 'json');
    await flush();
    expect(h.asked).toHaveLength(1);
  });
});

describe('toMarkerData', () => {
  it('moves to one-based positions, maps the severity and stringifies the code', () => {
    expect(
      toMarkerData(SEVERITY, {
        range: { start: { line: 1, character: 0 }, end: { line: 1, character: 4 } },
        message: 'Trailing comma',
        severity: 2,
        code: 519,
        source: 'json',
      }),
    ).toEqual({
      severity: 4,
      startLineNumber: 2,
      startColumn: 1,
      endLineNumber: 2,
      endColumn: 5,
      message: 'Trailing comma',
      code: '519',
      source: 'json',
    });
    expect(toMarkerData(SEVERITY, diagnostic('x')).severity).toBe(8);
    expect(toMarkerData(SEVERITY, { ...diagnostic('x'), severity: 4 }).severity).toBe(1);
    expect(toMarkerData(SEVERITY, { ...diagnostic('x'), severity: undefined }).severity).toBe(2);
  });
});
