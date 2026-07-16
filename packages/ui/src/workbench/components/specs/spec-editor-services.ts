/**
 * Spec editor language services — the Monaco glue over the pure cores
 * (`spec-doc-path.ts` navigation + `openapi-annotations.ts` catalog).
 *
 * Two services, vendor parity:
 * - hover: the specification's own description of the field under the
 *   cursor, titled with the document's format label;
 * - go-to-definition on local `$ref` values (`#/components/…`) —
 *   Monaco's native cmd/ctrl+click jump and cmd+hover underline, no
 *   opener plumbing.
 *
 * Providers register once per Monaco instance for the spec syntaxes
 * (same `WeakSet` idiom as the JWT link plane) and gate per model
 * through a registry the editor tab feeds on mount — every other
 * YAML/JSON editor in the app hits the registry miss and pays nothing.
 * Documents parse at most once per model version (the providers fire
 * on mouse moves; the cache makes repeat hovers free).
 */

import type { Monaco } from '@monaco-editor/react';
import type * as monaco from 'monaco-editor';
import type { Document } from 'yaml';
import { type AnnotatedSpecFormat, lookupSpecAnnotation } from './openapi-annotations';
import { parseSpecDocument, resolveSpecPointer, specPathAtOffset } from './spec-doc-path';
import { SPEC_FORMAT_LABELS } from './spec-format-labels';

/** Monaco language ids a spec root file can carry. */
const SPEC_LANGUAGES: ReadonlyArray<string> = ['yaml', 'json'];

/** Models currently backing an annotated spec editor, by URI. */
const specModels = new Map<string, AnnotatedSpecFormat>();

/** Monaco instances that already carry the providers. */
const registeredApis = new WeakSet<Monaco>();

/** Last parse per model — keyed by version so unchanged buffers never
 *  re-parse across hover/definition fires. */
const documentCache = new Map<string, { version: number; doc: Document | null }>();

function specDocumentFor(model: monaco.editor.ITextModel): Document | null {
  const uri = model.uri.toString();
  const version = model.getVersionId();
  const cached = documentCache.get(uri);
  if (cached !== undefined && cached.version === version) return cached.doc;
  const doc = parseSpecDocument(model.getValue());
  documentCache.set(uri, { version, doc });
  return doc;
}

function rangeOf(model: monaco.editor.ITextModel, start: number, end: number): monaco.IRange {
  const from = model.getPositionAt(start);
  const to = model.getPositionAt(end);
  return {
    startLineNumber: from.lineNumber,
    startColumn: from.column,
    endLineNumber: to.lineNumber,
    endColumn: to.column,
  };
}

function provideSpecHover(model: monaco.editor.ITextModel, position: monaco.Position): monaco.languages.Hover | null {
  const format = specModels.get(model.uri.toString());
  if (format === undefined) return null;
  const doc = specDocumentFor(model);
  if (doc === null) return null;
  const hit = specPathAtOffset(doc, model.getOffsetAt(position));
  if (hit === null) return null;
  const text = lookupSpecAnnotation(hit.path, format);
  if (text === null) return null;
  return {
    range: rangeOf(model, hit.start, hit.end),
    contents: [{ value: `**${SPEC_FORMAT_LABELS[format]}**` }, { value: text }],
  };
}

function provideSpecDefinition(
  model: monaco.editor.ITextModel,
  position: monaco.Position,
): monaco.languages.Definition | null {
  if (!specModels.has(model.uri.toString())) return null;
  const doc = specDocumentFor(model);
  if (doc === null) return null;
  const hit = specPathAtOffset(doc, model.getOffsetAt(position));
  // Only the reference VALUE jumps — the `$ref` key is a plain field.
  if (hit === null || hit.token !== 'value' || hit.path[hit.path.length - 1] !== '$ref') return null;
  if (hit.value === undefined || !hit.value.startsWith('#/')) return null;
  const target = resolveSpecPointer(doc, hit.value);
  if (target === null) return null;
  return { uri: model.uri, range: rangeOf(model, target.start, target.end) };
}

function ensureProviders(monacoApi: Monaco): void {
  if (registeredApis.has(monacoApi)) return;
  registeredApis.add(monacoApi);
  const hoverProvider: monaco.languages.HoverProvider = {
    provideHover: (model, position) => provideSpecHover(model, position),
  };
  const definitionProvider: monaco.languages.DefinitionProvider = {
    provideDefinition: (model, position) => provideSpecDefinition(model, position),
  };
  for (const language of SPEC_LANGUAGES) {
    monacoApi.languages.registerHoverProvider(language, hoverProvider);
    monacoApi.languages.registerDefinitionProvider(language, definitionProvider);
  }
}

/**
 * Enroll a mounted spec editor's model for the language services.
 * OpenAPI formats only — other formats return an inert disposable (the
 * catalog has nothing for them, so the registry stays clean). Call the
 * disposable on unmount; the providers themselves live for the app
 * (registry-gated), matching the completion/JWT planes.
 */
export function attachSpecEditorServices(
  editor: monaco.editor.IStandaloneCodeEditor,
  monacoApi: Monaco,
  format: string,
): monaco.IDisposable {
  const model = editor.getModel();
  if (model === null || (format !== 'openapi-3.0' && format !== 'openapi-3.1')) {
    return { dispose: () => {} };
  }
  const uri = model.uri.toString();
  specModels.set(uri, format);
  ensureProviders(monacoApi);
  return {
    dispose: () => {
      specModels.delete(uri);
      documentCache.delete(uri);
    },
  };
}
