/**
 * useMonacoJsonShadow — a body editor's JSON buffer validates through
 * its shadow (every `{{ref}}` a value) for as long as the buffer is
 * JSON. The shadow follows the editor's model: built when the model is
 * `json`, rebuilt on a model swap or a language change (the validator
 * plane re-enters the model on the same event, ahead of this hook),
 * disposed with the editor. Other languages and read-only viewers
 * keep the plane's direct validation.
 */

import type * as monaco from 'monaco-editor';
import { useEffect } from 'react';
import { JSON_LANGUAGE_ID } from '../../monaco/json-diagnostics';
import { createJsonShadow, type JsonShadowMonaco } from './json-shadow';

export interface MonacoJsonShadowOptions {
  enabled: boolean;
}

export function useMonacoJsonShadow(
  editor: monaco.editor.IStandaloneCodeEditor | null,
  monacoApi: JsonShadowMonaco | null,
  { enabled }: MonacoJsonShadowOptions,
): void {
  useEffect(() => {
    if (!editor || !monacoApi || !enabled) return;
    let shadow: monaco.IDisposable | null = null;
    const build = () => {
      shadow?.dispose();
      shadow = null;
      const model = editor.getModel();
      if (!model || model.getLanguageId() !== JSON_LANGUAGE_ID) return;
      shadow = createJsonShadow(monacoApi, model);
    };
    build();
    const subscriptions = [editor.onDidChangeModel(build), editor.onDidChangeModelLanguage(build)];
    return () => {
      for (const subscription of subscriptions) subscription.dispose();
      shadow?.dispose();
    };
  }, [editor, monacoApi, enabled]);
}
