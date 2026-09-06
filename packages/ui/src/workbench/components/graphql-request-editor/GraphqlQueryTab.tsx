/**
 * GraphqlQueryTab — the Query tab: the EXPLORER pane on the left (the
 * docs explorer AND the two-way builder over the resolved schema; until
 * a source resolves, the CTA scaffold — introspect / use a spec /
 * import a schema, each live)
 * beside the QUERY EDITOR (Monaco `graphql` over our Monarch grammar,
 * diagnostics + completion + hover bound to `@openheaders/core/graphql`
 * and fed the schema, the prettify glyph through the core printer)
 * with the collapsible VARIABLES drawer under it (Monaco JSON,
 * validated against the selected operation's variable definitions and
 * the schema; "Generate variables" from the synthesis, schema-aware).
 * The explorer / editor split is the WS compose recipe's Allotment.
 */

import {
  type BuilderContext,
  type BuilderEdit,
  censusDocument,
  type DocumentNode,
  exampleVariables,
  type GraphqlSchema,
  type OperationDefinitionNode,
  parseDocument,
  type ParseResult,
  printNode,
  selectedOperation,
  validateVariables,
} from '@openheaders/core/graphql';
import { CaretDownOutlined, CaretRightOutlined, FormatPainterOutlined } from '@ant-design/icons';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Allotment } from 'allotment';
import { Button, Tooltip, Typography, theme } from 'antd';
import type * as monaco from 'monaco-editor';
import type React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CodeEditor from '../shared/CodeEditor';
import type { GraphqlDraft } from './draft';
import { attachGraphqlEditorServices, executeBuilderEdits } from './graphql-editor-services';
import GraphqlExplorer, { type GraphqlBuilder } from './GraphqlExplorer';

const { Text } = Typography;

/** The explorer's schema sources — the CTA scaffold's three actions. */
export interface GraphqlExplorerSources {
  /** The endpoint is set — introspection has somewhere to go. */
  canIntrospect: boolean;
  introspecting: boolean;
  onIntrospect: () => void;
  /** Switches to the Schema tab, where the spec picker lives. */
  onUseSpec: () => void;
  onImportSchema: () => void;
}

interface GraphqlQueryTabProps {
  draft: GraphqlDraft;
  setDraft: Dispatch<SetStateAction<GraphqlDraft>>;
  /** The editor's ONE parse of the document (the operation select and
   *  the send read it too) — the prettify and generate gestures share it. */
  parsed: ParseResult;
  /** The resolved schema — null until a source resolves. */
  schema: GraphqlSchema | null;
  sources: GraphqlExplorerSources;
}

/** The operation the pick names — the stored name when the document
 *  holds it, the first operation otherwise; null on an empty or broken
 *  document. */
function pickedOperation(document: DocumentNode, operationName: string): OperationDefinitionNode | null {
  const census = censusDocument(document);
  const picked = selectedOperation(census, operationName === '' ? undefined : operationName);
  if (picked === null) return null;
  for (const definition of document.definitions) {
    if (definition.kind === 'OperationDefinition' && definition.start === picked.start) return definition;
  }
  return null;
}

const EXPLORER_SOURCES = ['introspect', 'spec', 'import'] as const;

const GraphqlQueryTab: React.FC<GraphqlQueryTabProps> = ({ draft, setDraft, parsed, schema, sources }) => {
  const { token } = theme.useToken();
  const t = useT();
  const [variablesOpen, setVariablesOpen] = useState(() => draft.variables.trim() !== '');
  const servicesRef = useRef<{ dispose: () => void; setSchema: (schema: GraphqlSchema | null) => void } | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<import('@monaco-editor/react').Monaco | null>(null);
  // The mount callback reads the schema through a ref — an editor that
  // mounts after the source resolved enrolls with it right away.
  const schemaRef = useRef(schema);
  schemaRef.current = schema;
  useEffect(() => {
    servicesRef.current?.setSchema(schema);
  }, [schema]);

  const canPrettify = parsed.document !== null && draft.query.trim() !== '';
  const operation = useMemo(
    () => (parsed.document === null ? null : pickedOperation(parsed.document, draft.operationName)),
    [parsed.document, draft.operationName],
  );
  const canGenerate = operation !== null && operation.variableDefinitions.length > 0;
  const variableProblems = useMemo(
    () => (operation === null ? [] : validateVariables(operation, schema, draft.variables)),
    [operation, schema, draft.variables],
  );

  const handlePrettify = useCallback(() => {
    if (parsed.document === null) return;
    const pretty = printNode(parsed.document);
    setDraft((d) => (d.query === pretty ? d : { ...d, query: pretty }));
  }, [parsed.document, setDraft]);

  const handleGenerate = useCallback(() => {
    if (operation === null) return;
    const variables = JSON.stringify(exampleVariables(operation, schema), null, 2);
    setVariablesOpen(true);
    setDraft((d) => ({ ...d, variables }));
  }, [operation, schema, setDraft]);

  // The explorer's one-way insert: the text lands at the cursor (or
  // over the selection) through `executeEdits`, so it is undoable and
  // dirty derives like any typed edit.
  const insertAtCursor = useCallback((text: string) => {
    const editor = editorRef.current;
    const monacoApi = monacoRef.current;
    if (editor === null || monacoApi === null) return;
    const selection = editor.getSelection() ?? new monacoApi.Selection(1, 1, 1, 1);
    editor.pushUndoStop();
    editor.executeEdits('graphql-explorer-insert', [{ range: selection, text }]);
    editor.pushUndoStop();
    editor.focus();
  }, []);

  // The builder's two-way half: a gesture plans span edits over the
  // editor's CURRENT text (the tab's parse serves while the editor holds
  // the draft; a buffer mid-flight re-parses once) and lands them through
  // the edit stack, so the change re-parses like typed text and the
  // explorer re-projects from that one parse. Focus stays in the explorer.
  const broken = parsed.document === null && draft.query.trim() !== '';
  const runBuilder = useCallback(
    (plan: (context: BuilderContext) => readonly BuilderEdit[]) => {
      const editor = editorRef.current;
      const monacoApi = monacoRef.current;
      if (editor === null || monacoApi === null || schema === null) return;
      const source = editor.getValue();
      const current = source === draft.query;
      const document = current ? parsed.document : parseDocument(source).document;
      const picked = current ? operation : document === null ? null : pickedOperation(document, draft.operationName);
      executeBuilderEdits(editor, monacoApi, plan({ source, document, operation: picked, schema }));
    },
    [schema, draft.query, draft.operationName, parsed.document, operation],
  );
  const builder = useMemo<GraphqlBuilder>(() => ({ operation, broken, run: runBuilder }), [operation, broken, runBuilder]);

  const sourceLabel = (source: (typeof EXPLORER_SOURCES)[number]): string => {
    switch (source) {
      case 'introspect':
        return sources.introspecting
          ? t('workbench.editors.graphql.explorer.introspecting')
          : t('workbench.editors.graphql.explorer.introspect');
      case 'spec':
        return t('workbench.editors.graphql.explorer.useSpec');
      case 'import':
        return t('workbench.editors.graphql.explorer.importSchema');
    }
  };
  const sourceAction = (source: (typeof EXPLORER_SOURCES)[number]): (() => void) => {
    switch (source) {
      case 'introspect':
        return sources.onIntrospect;
      case 'spec':
        return sources.onUseSpec;
      case 'import':
        return sources.onImportSchema;
    }
  };

  const firstProblem = variableProblems[0];

  return (
    <div style={{ flex: 1, minHeight: 320, display: 'flex' }} data-testid="graphql-query-tab">
      <Allotment proportionalLayout separator>
        <Allotment.Pane minSize={160} preferredSize="30%">
          {schema !== null ? (
            <GraphqlExplorer schema={schema} onInsert={insertAtCursor} builder={builder} />
          ) : (
            // The explorer's empty state — the reference's CTA trio in our
            // scaffold idiom: the fact, the hint, three live actions.
            <div
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: 16,
                textAlign: 'center',
                borderRight: `1px solid ${token.colorBorderSecondary}`,
              }}
              data-testid="graphql-explorer-empty"
            >
              <Text strong style={{ fontSize: 12 }}>
                {t('workbench.editors.graphql.explorer.emptyTitle')}
              </Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {t('workbench.editors.graphql.explorer.emptyHint')}
              </Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                {EXPLORER_SOURCES.map((source) => {
                  const introspect = source === 'introspect';
                  const disabled = introspect && (!sources.canIntrospect || sources.introspecting);
                  return (
                    <Tooltip
                      key={source}
                      title={introspect && !sources.canIntrospect ? t('workbench.editors.graphql.explorer.needsUrl') : undefined}
                    >
                      <span style={{ display: 'inline-flex' }}>
                        <Button
                          type="link"
                          size="small"
                          disabled={disabled}
                          onClick={sourceAction(source)}
                          style={{ fontSize: 12, padding: 0, height: 'auto' }}
                          data-testid={`graphql-explorer-${source}`}
                        >
                          {sourceLabel(source)}
                        </Button>
                      </span>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          )}
        </Allotment.Pane>
        <Allotment.Pane minSize={240}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0 6px 8px' }}>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {t('workbench.editors.graphql.query.hint')}
              </Text>
              <span style={{ flex: 1 }} />
              <Tooltip title={t('workbench.editors.graphql.query.prettify')}>
                <Button
                  size="small"
                  type="text"
                  icon={<FormatPainterOutlined />}
                  disabled={!canPrettify}
                  onClick={handlePrettify}
                  aria-label={t('workbench.editors.graphql.query.prettify')}
                  data-testid="graphql-prettify"
                />
              </Tooltip>
            </div>
            <div style={{ flex: 1, minHeight: 120, display: 'flex', flexDirection: 'column', paddingLeft: 8 }}>
              <CodeEditor
                language="graphql"
                value={draft.query}
                onChange={(query) => setDraft((d) => ({ ...d, query }))}
                placeholder={t('workbench.editors.graphql.query.placeholder')}
                fill
                onEditorMount={(editor, monacoApi) => {
                  editorRef.current = editor;
                  monacoRef.current = monacoApi;
                  servicesRef.current?.dispose();
                  const services = attachGraphqlEditorServices(editor, monacoApi);
                  services.setSchema(schemaRef.current);
                  servicesRef.current = services;
                  editor.onDidDispose(() => {
                    servicesRef.current?.dispose();
                    servicesRef.current = null;
                    editorRef.current = null;
                  });
                }}
              />
            </div>
            {/* The Variables drawer — collapsed by default on a request
              without variables, the header row always attached. */}
            <div
              style={{
                borderTop: `1px solid ${token.colorBorderSecondary}`,
                marginLeft: 8,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                flex: variablesOpen ? '0 0 38%' : '0 0 auto',
              }}
              data-testid="graphql-variables-drawer"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
                <Button
                  size="small"
                  type="text"
                  icon={variablesOpen ? <CaretDownOutlined /> : <CaretRightOutlined />}
                  onClick={() => setVariablesOpen((open) => !open)}
                  style={{ fontSize: 12, fontWeight: 600 }}
                  aria-expanded={variablesOpen}
                  data-testid="graphql-variables-toggle"
                >
                  {t('workbench.editors.graphql.variables.title')}
                </Button>
                {firstProblem !== undefined && (
                  <Tooltip
                    title={
                      <div style={{ whiteSpace: 'pre-wrap' }}>
                        {variableProblems.map((problem) => problem.message).join('\n')}
                      </div>
                    }
                  >
                    <Text
                      type={firstProblem.severity === 'error' ? 'danger' : 'warning'}
                      style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}
                      data-testid="graphql-variables-problems"
                    >
                      {t('workbench.editors.graphql.variables.problems', { count: variableProblems.length })} ·{' '}
                      {firstProblem.message}
                    </Text>
                  </Tooltip>
                )}
                <span style={{ flex: 1 }} />
                <Tooltip
                  title={
                    canGenerate
                      ? t('workbench.editors.graphql.variables.generateHint')
                      : t('workbench.editors.graphql.variables.generateNeedsOperation')
                  }
                >
                  <span style={{ display: 'inline-flex' }}>
                    <Button
                      size="small"
                      type="text"
                      disabled={!canGenerate}
                      onClick={handleGenerate}
                      style={{ fontSize: 11 }}
                      data-testid="graphql-generate-variables"
                    >
                      {t('workbench.editors.graphql.variables.generate')}
                    </Button>
                  </span>
                </Tooltip>
              </div>
              {variablesOpen && (
                <div style={{ flex: 1, minHeight: 80, display: 'flex', flexDirection: 'column' }}>
                  <CodeEditor
                    language="json"
                    value={draft.variables}
                    onChange={(variables) => setDraft((d) => ({ ...d, variables }))}
                    placeholder={t('workbench.editors.graphql.variables.placeholder')}
                    fill
                  />
                </div>
              )}
            </div>
          </div>
        </Allotment.Pane>
      </Allotment>
    </div>
  );
};

export default GraphqlQueryTab;
