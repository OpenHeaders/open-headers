// @vitest-environment jsdom
/**
 * The Monaco host of the JSON shadow — `useMonacoJsonShadow` building
 * the shadow for a JSON model, rebuilding it on a model swap or a
 * language change, and disposing it with the editor. The shadow itself
 * is a spy; the fake stands in for the editor's model and events.
 */

import { createJsonShadow } from '@openheaders/ui/workbench/components/template-input/monaco/json-shadow';
import { useMonacoJsonShadow } from '@openheaders/ui/workbench/components/template-input/monaco/use-monaco-json-shadow';
import { cleanup, render } from '@testing-library/react';
import type * as monaco from 'monaco-editor';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const shadowDispose = vi.fn();

vi.mock('@openheaders/ui/workbench/components/template-input/monaco/json-shadow', () => ({
  createJsonShadow: vi.fn(() => ({ dispose: shadowDispose })),
}));

beforeEach(() => {
  vi.mocked(createJsonShadow).mockClear();
  shadowDispose.mockClear();
});
afterEach(cleanup);

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
  get size(): number {
    return this.listeners.size;
  }
}

function fakeModel(language: string) {
  return { getLanguageId: () => language };
}

function fakeEditor(language: string | null) {
  let model = language === null ? null : fakeModel(language);
  const modelChanged = new Emitter<void>();
  const languageChanged = new Emitter<void>();
  const api = {
    getModel: () => model,
    onDidChangeModel: modelChanged.on,
    onDidChangeModelLanguage: languageChanged.on,
  };
  return {
    editor: api as unknown as monaco.editor.IStandaloneCodeEditor,
    model: () => model,
    swapModel(next: string) {
      model = fakeModel(next);
      modelChanged.fire();
    },
    setLanguage(next: string) {
      model = fakeModel(next);
      languageChanged.fire();
    },
    listenerCount: () => modelChanged.size + languageChanged.size,
  };
}

const monacoApi = {} as Parameters<typeof useMonacoJsonShadow>[1];

function Host({
  editor,
  api = monacoApi,
  enabled = true,
}: {
  editor: monaco.editor.IStandaloneCodeEditor | null;
  api?: Parameters<typeof useMonacoJsonShadow>[1];
  enabled?: boolean;
}) {
  useMonacoJsonShadow(editor, api, { enabled });
  return null;
}

describe('useMonacoJsonShadow', () => {
  it('builds the shadow for a JSON model with the namespace and the model', () => {
    const fake = fakeEditor('json');
    render(<Host editor={fake.editor} />);
    expect(createJsonShadow).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createJsonShadow).mock.calls[0][0]).toBe(monacoApi);
    expect(vi.mocked(createJsonShadow).mock.calls[0][1]).toBe(fake.model());
  });

  it('builds nothing for another language, a missing model, a missing namespace, or when disabled', () => {
    render(<Host editor={fakeEditor('javascript').editor} />);
    render(<Host editor={fakeEditor(null).editor} />);
    render(<Host editor={fakeEditor('json').editor} api={null} />);
    render(<Host editor={fakeEditor('json').editor} enabled={false} />);
    render(<Host editor={null} />);
    expect(createJsonShadow).not.toHaveBeenCalled();
  });

  it('follows a language change into and out of JSON', () => {
    const fake = fakeEditor('plaintext');
    render(<Host editor={fake.editor} />);
    expect(createJsonShadow).not.toHaveBeenCalled();
    fake.setLanguage('json');
    expect(createJsonShadow).toHaveBeenCalledTimes(1);
    fake.setLanguage('plaintext');
    expect(shadowDispose).toHaveBeenCalledTimes(1);
    expect(createJsonShadow).toHaveBeenCalledTimes(1);
  });

  it('rebuilds on a model swap, disposing the previous shadow first', () => {
    const fake = fakeEditor('json');
    render(<Host editor={fake.editor} />);
    fake.swapModel('json');
    expect(shadowDispose).toHaveBeenCalledTimes(1);
    expect(createJsonShadow).toHaveBeenCalledTimes(2);
    expect(vi.mocked(createJsonShadow).mock.calls[1][1]).toBe(fake.model());
  });

  it('disposes the shadow and its subscriptions with the editor', () => {
    const fake = fakeEditor('json');
    const view = render(<Host editor={fake.editor} />);
    expect(fake.listenerCount()).toBe(2);
    view.unmount();
    expect(shadowDispose).toHaveBeenCalledTimes(1);
    expect(fake.listenerCount()).toBe(0);
  });
});
