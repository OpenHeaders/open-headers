/**
 * The Query editor's Monaco binding over `@openheaders/core/graphql` —
 * diagnostics (`parseDocument` + `validateDocument`) as model markers,
 * completion (`completionsAt`) as a completion provider. One grammar,
 * three surfaces: the same parser the executor picks operations with
 * drives the squigglies here.
 *
 * Providers register ONCE per Monaco instance for the `graphql`
 * language (the spec editor's registry idiom) and answer only for the
 * models an editor enrolled through {@link attachGraphqlEditorServices}
 * — the legacy body mode's `graphql` editor keeps its plain tokenizer
 * until it enrolls. The schema is per enrolled model: `null` until the
 * schema plane lands, which still yields fragment, variable and keyword
 * completion and the schema-free validation rules.
 */

import type { Monaco } from '@monaco-editor/react';
import {
  type CompletionItem,
  type CompletionKind,
  completionsAt,
  type GraphqlError,
  type GraphqlSchema,
  parseDocument,
  positionAt,
  type ValidationRule,
  validateDocument,
} from '@openheaders/core/graphql';
import type * as monaco from 'monaco-editor';

export const GRAPHQL_MARKER_OWNER = 'openheaders-graphql';

interface EnrolledModel {
  schema: GraphqlSchema | null;
}

const enrolled = new Map<string, EnrolledModel>();
const registeredApis = new WeakSet<Monaco>();

/** One editor diagnostic — a validation rule's, or the parser's. */
export interface GraphqlEditorDiagnostic extends GraphqlError {
  readonly rule: ValidationRule | 'syntax';
}

/** The core diagnostics of one document — a syntax error alone when the
 *  parse fails, the validation subset otherwise. */
export function graphqlDiagnostics(source: string, schema: GraphqlSchema | null): readonly GraphqlEditorDiagnostic[] {
  const parsed = parseDocument(source);
  if (parsed.document === null) {
    return parsed.errors.map((error) => ({ ...error, rule: 'syntax' as const }));
  }
  return validateDocument(parsed.document, schema);
}

function rangeOf(source: string, start: number, end: number): monaco.IRange {
  const from = positionAt(source, start);
  // A zero-width span still needs a visible squiggle — extend one column.
  const to = positionAt(source, end > start ? end : start + 1);
  return { startLineNumber: from.line, startColumn: from.column, endLineNumber: to.line, endColumn: to.column };
}

function refreshMarkers(monacoApi: Monaco, model: monaco.editor.ITextModel): void {
  const entry = enrolled.get(model.uri.toString());
  if (entry === undefined) return;
  const source = model.getValue();
  const markers: monaco.editor.IMarkerData[] = graphqlDiagnostics(source, entry.schema).map((diagnostic) => ({
    ...rangeOf(source, diagnostic.start, diagnostic.end),
    message: diagnostic.message,
    severity: monacoApi.MarkerSeverity.Error,
    source: diagnostic.rule,
  }));
  monacoApi.editor.setModelMarkers(model, GRAPHQL_MARKER_OWNER, markers);
}

const COMPLETION_KIND: Readonly<Record<CompletionKind, keyof typeof monaco.languages.CompletionItemKind>> = {
  keyword: 'Keyword',
  field: 'Field',
  argument: 'Property',
  'input-field': 'Property',
  'enum-value': 'EnumMember',
  boolean: 'Constant',
  variable: 'Variable',
  fragment: 'Reference',
  type: 'Class',
  directive: 'Event',
  'directive-location': 'EnumMember',
};

function toCompletionItem(
  monacoApi: Monaco,
  item: CompletionItem,
  range: monaco.IRange,
): monaco.languages.CompletionItem {
  const kind = monacoApi.languages.CompletionItemKind[COMPLETION_KIND[item.kind]];
  const documentation =
    item.description !== null || item.deprecationReason !== null
      ? {
          value: [
            item.description ?? '',
            item.deprecationReason !== null ? `\n\n**Deprecated**: ${item.deprecationReason}` : '',
          ].join(''),
        }
      : undefined;
  return {
    label: item.label,
    kind,
    detail: item.detail ?? undefined,
    documentation,
    insertText: item.insertText ?? item.label,
    range,
    ...(item.deprecationReason !== null ? { tags: [monacoApi.languages.CompletionItemTag.Deprecated] } : {}),
  };
}

function provideCompletions(
  monacoApi: Monaco,
  model: monaco.editor.ITextModel,
  position: monaco.Position,
): monaco.languages.CompletionList {
  const entry = enrolled.get(model.uri.toString());
  if (entry === undefined) return { suggestions: [] };
  const source = model.getValue();
  const result = completionsAt(source, model.getOffsetAt(position), entry.schema);
  if (result.items.length === 0) return { suggestions: [] };
  const range = rangeOf(source, result.replace.start, result.replace.end);
  return { suggestions: result.items.map((item) => toCompletionItem(monacoApi, item, range)) };
}

function ensureProviders(monacoApi: Monaco): void {
  if (registeredApis.has(monacoApi)) return;
  registeredApis.add(monacoApi);
  const completionProvider: monaco.languages.CompletionItemProvider = {
    triggerCharacters: ['{', '(', '$', '@', '.', ' '],
    provideCompletionItems: (model, position) => provideCompletions(monacoApi, model, position),
  };
  monacoApi.languages.registerCompletionItemProvider('graphql', completionProvider);
}

/**
 * Enroll a mounted Query editor's model for diagnostics + completion.
 * Markers refresh on every content change; the disposable clears them
 * and drops the enrollment — call it on unmount. `setSchema` swaps the
 * schema the providers answer with (the schema plane's hook).
 */
export function attachGraphqlEditorServices(
  editor: monaco.editor.IStandaloneCodeEditor,
  monacoApi: Monaco,
): { dispose: () => void; setSchema: (schema: GraphqlSchema | null) => void } {
  const model = editor.getModel();
  if (model === null) return { dispose: () => {}, setSchema: () => {} };
  const uri = model.uri.toString();
  enrolled.set(uri, { schema: null });
  ensureProviders(monacoApi);
  refreshMarkers(monacoApi, model);
  const subscription = model.onDidChangeContent(() => refreshMarkers(monacoApi, model));
  return {
    dispose: () => {
      subscription.dispose();
      enrolled.delete(uri);
      if (!model.isDisposed()) monacoApi.editor.setModelMarkers(model, GRAPHQL_MARKER_OWNER, []);
    },
    setSchema: (schema) => {
      const entry = enrolled.get(uri);
      if (entry === undefined) return;
      entry.schema = schema;
      refreshMarkers(monacoApi, model);
    },
  };
}
