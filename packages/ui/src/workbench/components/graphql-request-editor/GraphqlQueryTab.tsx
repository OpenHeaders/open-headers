/**
 * GraphqlQueryTab — the Query tab: the EXPLORER pane on the left (the
 * docs explorer AND the two-way builder over the resolved schema; until
 * a source resolves, the CTA scaffold — introspect / use a spec /
 * import a schema, each live)
 * beside the QUERY EDITOR (Monaco `graphql` over our Monarch grammar,
 * diagnostics + completion + hover bound to `@openheaders/core/graphql`
 * and fed the schema; its Find / Replace / Format cluster — Format
 * through the core printer's Monaco provider — and the Editor menu
 * live in the row ABOVE the buffer, the Body tab's toolbar idiom, so
 * the buttons never cover the document's first lines) with the
 * collapsible VARIABLES drawer
 * under it (Monaco JSON, validated against the selected operation's
 * variable definitions and the schema; "Generate variables" from the
 * synthesis, schema-aware; its own cluster in the drawer's header).
 * The PICK (`operationName`) follows the document: a check that lands
 * in another operation moves it there, and the cursor's own operation
 * claims it on the user's navigation (a click, the arrow keys — never
 * typing, an edit, or a value swap) whenever the document holds
 * several — the tree, the select and the Query button read one state.
 * The explorer / editor split is the WS compose recipe's Allotment —
 * the explorer pane HIDES when collapsed and its strip sits flush
 * beside the editor then (the WS rail's discipline: one tree in every
 * state, the editor never remounts on a toggle).
 */

import {
  type BuilderContext,
  type BuilderEdit,
  type BuilderPath,
  censusDocument,
  type DocumentNode,
  exampleVariables,
  type GraphqlSchema,
  type OperationDefinitionNode,
  type OperationType,
  operationForType,
  operationTargetName,
  parseDocument,
  type ParseResult,
  selectFieldEdits,
  selectedOperation,
  validateVariables,
  wireOperationName,
} from '@openheaders/core/graphql';
import {
  CaretDownOutlined,
  CaretRightOutlined,
  CloudDownloadOutlined,
  DeploymentUnitOutlined,
  FileTextOutlined,
  ImportOutlined,
} from '@ant-design/icons';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Allotment } from 'allotment';
import { Alert, Button, Divider, Tooltip, Typography, theme } from 'antd';
import type * as monaco from 'monaco-editor';
import type React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSettingValue } from '../../settings/hooks';
import CodeEditor from '../shared/CodeEditor';
import CodeEditorActions, { type CodeEditorActionsTarget } from '../shared/CodeEditorActions';
import EditorViewMenu from '../shared/EditorViewMenu';
import type { GraphqlDraft } from './draft';
import {
  attachGraphqlEditorServices,
  type BuilderUndo,
  executeBuilderEdits,
  sealBuilderEdits,
} from './graphql-editor-services';
import GraphqlExplorer, { type GraphqlBuilder, GraphqlExplorerStrip } from './GraphqlExplorer';

const { Text } = Typography;

/** The explorer's schema sources — the CTA scaffold's three actions. */
export interface GraphqlExplorerSources {
  /** The endpoint is set — introspection has somewhere to go. */
  canIntrospect: boolean;
  introspecting: boolean;
  onIntrospect: () => void;
  /** Introspection is the active source — the explorer header offers Refresh. */
  refreshable: boolean;
  /** The last introspection's failure, one line — the scaffold shows it with a retry. */
  error: string | null;
  /** Switches to the Schema tab, where the spec picker lives. */
  onUseSpec: () => void;
  onImportSchema: () => void;
}

interface GraphqlQueryTabProps {
  draft: GraphqlDraft;
  setDraft: Dispatch<SetStateAction<GraphqlDraft>>;
  /** The editor's ONE parse of the document (the operation select and
   *  the send read it too) — the generate gesture and the builder share it. */
  parsed: ParseResult;
  /** The resolved schema — null until a source resolves. */
  schema: GraphqlSchema | null;
  sources: GraphqlExplorerSources;
  /** The explorer pane folded to its strip — owned by the editor so a tab switch keeps it. */
  explorerCollapsed: boolean;
  onExplorerCollapsedChange: (collapsed: boolean) => void;
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

/** The two sources that need no endpoint — the row under the rule. */
const EXPLORER_LOCAL_SOURCES = ['spec', 'import'] as const;

const EXPLORER_LOCAL_SOURCE_ICONS: Record<(typeof EXPLORER_LOCAL_SOURCES)[number], React.ReactNode> = {
  spec: <FileTextOutlined />,
  import: <ImportOutlined />,
};

const EXPLORER_LINK_STYLE: React.CSSProperties = { fontSize: 12, padding: 0, height: 'auto' };

const GraphqlQueryTab: React.FC<GraphqlQueryTabProps> = ({
  draft,
  setDraft,
  parsed,
  schema,
  sources,
  explorerCollapsed,
  onExplorerCollapsedChange,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const [variablesOpen, setVariablesOpen] = useState(() => draft.variables.trim() !== '');
  // The clusters live in the rows above the editors (`actions="external"`).
  const queryActionsRef = useRef<CodeEditorActionsTarget | null>(null);
  const variablesActionsRef = useRef<CodeEditorActionsTarget | null>(null);
  // The tab's one Wrap knob, shared by the query and variables editors:
  // the global `editor.wordWrap` until the Editor menu toggles it, the
  // toggle's value after ("This editor" over "All editors").
  const globalWordWrap = useSettingValue('editor.wordWrap');
  const [wrapOverride, setWrapOverride] = useState<boolean | null>(null);
  const wrap = wrapOverride ?? globalWordWrap !== 'off';
  const wordWrapOverride = wrapOverride === null ? undefined : wrapOverride ? 'on' : 'off';
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

  const operation = useMemo(
    () => (parsed.document === null ? null : pickedOperation(parsed.document, draft.operationName)),
    [parsed.document, draft.operationName],
  );
  // The pick's settle: `name` becomes the operation Query runs when the
  // document holds several and the wire does not run it already — so a
  // gesture that lands where the pick sits leaves the draft alone.
  const settlePick = useCallback(
    (document: DocumentNode | null, name: string) => {
      if (document === null) return;
      const census = censusDocument(document);
      if (census.operations.length < 2 || !census.operations.some((entry) => entry.name === name)) return;
      setDraft((d) =>
        wireOperationName(census, d.operationName === '' ? undefined : d.operationName) === name
          ? d
          : { ...d, operationName: name },
      );
    },
    [setDraft],
  );
  // The cursor-follow reads the tab's latest parse through a ref — the
  // listener is bound once, at the editor's mount.
  const parsedRef = useRef(parsed);
  parsedRef.current = parsed;
  const followCursor = useCallback(
    (offset: number) => {
      const document = parsedRef.current.document;
      if (document === null) return;
      for (const definition of document.definitions) {
        if (definition.kind !== 'OperationDefinition' || definition.name === null) continue;
        if (offset < definition.start || offset > definition.end) continue;
        settlePick(document, definition.name.value);
        return;
      }
    },
    [settlePick],
  );
  const canGenerate = operation !== null && operation.variableDefinitions.length > 0;
  const variableProblems = useMemo(
    () => (operation === null ? [] : validateVariables(operation, schema, draft.variables)),
    [operation, schema, draft.variables],
  );

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
  const builderSite = useCallback(() => {
    const editor = editorRef.current;
    const monacoApi = monacoRef.current;
    if (editor === null || monacoApi === null || schema === null) return null;
    const source = editor.getValue();
    const current = source === draft.query;
    const document = current ? parsed.document : parseDocument(source).document;
    const picked = current ? operation : document === null ? null : pickedOperation(document, draft.operationName);
    const context: BuilderContext = { source, document, operation: picked, schema };
    return { editor, monacoApi, context };
  }, [schema, draft.query, draft.operationName, parsed.document, operation]);
  const runBuilder = useCallback(
    (plan: (context: BuilderContext) => readonly BuilderEdit[], undo: BuilderUndo = 'step') => {
      const site = builderSite();
      if (site !== null) executeBuilderEdits(site.editor, site.monacoApi, plan(site.context), undo);
    },
    [builderSite],
  );
  // A check lands where `operationForType` says — the pick follows it
  // there, read off the text the edit left behind.
  const selectBuilder = useCallback(
    (operationType: OperationType, path: BuilderPath, undo: BuilderUndo = 'step') => {
      const site = builderSite();
      if (site === null) return;
      const landing = operationTargetName(operationForType(site.context, operationType, path));
      executeBuilderEdits(site.editor, site.monacoApi, selectFieldEdits(site.context, operationType, path), undo);
      if (landing !== null) settlePick(parseDocument(site.editor.getValue()).document, landing);
    },
    [builderSite, settlePick],
  );
  const sealBuilder = useCallback(() => {
    const editor = editorRef.current;
    if (editor !== null) sealBuilderEdits(editor);
  }, []);
  const builder = useMemo<GraphqlBuilder>(
    () => ({ operation, broken, run: runBuilder, select: selectBuilder, seal: sealBuilder }),
    [operation, broken, runBuilder, selectBuilder, sealBuilder],
  );

  const localSourceLabel = (source: (typeof EXPLORER_LOCAL_SOURCES)[number]): string =>
    source === 'spec'
      ? t('workbench.editors.graphql.explorer.useSpec')
      : t('workbench.editors.graphql.explorer.importSchema');
  const localSourceAction = (source: (typeof EXPLORER_LOCAL_SOURCES)[number]): (() => void) =>
    source === 'spec' ? sources.onUseSpec : sources.onImportSchema;

  const firstProblem = variableProblems[0];

  return (
    <div style={{ flex: 1, minHeight: 320, display: 'flex' }} data-testid="graphql-query-tab">
      {explorerCollapsed && <GraphqlExplorerStrip onExpand={() => onExplorerCollapsedChange(false)} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <Allotment proportionalLayout separator>
          <Allotment.Pane minSize={160} preferredSize="30%" visible={!explorerCollapsed}>
            {schema !== null ? (
              <GraphqlExplorer
                schema={schema}
                onInsert={insertAtCursor}
                builder={builder}
                onHide={() => onExplorerCollapsedChange(true)}
                refresh={
                  sources.refreshable ? { refreshing: sources.introspecting, onRefresh: sources.onIntrospect } : null
                }
              />
            ) : (
              // The explorer's empty state — a failed introspection's card at
              // the top, then the CTA scaffold centered in the rest: the glyph,
              // the fact, ONE slot the endpoint decides — the hint until the
              // URL is set, the introspection action after — a rule, and the
              // two endpoint-free sources in a row under it.
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 0,
                  borderRight: `1px solid ${token.colorBorderSecondary}`,
                }}
                data-testid="graphql-explorer-empty"
              >
                {sources.error !== null && (
                  // Title-only: the description variant forces antd's large
                  // title size; the lines and the retry compose in the slot.
                  <Alert
                    type="error"
                    showIcon
                    title={
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                        <Text strong style={{ fontSize: 12 }}>
                          {t('workbench.editors.graphql.explorer.loadFailed')}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 11, wordBreak: 'break-word' }}>
                          {sources.error}
                        </Text>
                        <Button
                          size="small"
                          loading={sources.introspecting}
                          onClick={sources.onIntrospect}
                          style={{ fontSize: 11, marginTop: 2 }}
                          data-testid="graphql-explorer-retry"
                        >
                          {t('workbench.editors.graphql.explorer.tryAgain')}
                        </Button>
                      </div>
                    }
                    style={{ margin: '8px 8px 0 0', padding: '6px 10px', fontSize: 12, alignItems: 'flex-start' }}
                    data-testid="graphql-explorer-error"
                  />
                )}
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: 16,
                    textAlign: 'center',
                  }}
                >
                <DeploymentUnitOutlined style={{ fontSize: 32, color: token.colorTextQuaternary, marginBottom: 4 }} />
                <Text strong style={{ fontSize: 13 }}>
                  {t('workbench.editors.graphql.explorer.emptyTitle')}
                </Text>
                {sources.canIntrospect ? (
                  <Button
                    type="link"
                    size="small"
                    icon={<CloudDownloadOutlined />}
                    loading={sources.introspecting}
                    onClick={sources.onIntrospect}
                    style={EXPLORER_LINK_STYLE}
                    data-testid="graphql-explorer-introspect"
                  >
                    {sources.introspecting
                      ? t('workbench.editors.graphql.explorer.introspecting')
                      : t('workbench.editors.graphql.explorer.introspect')}
                  </Button>
                ) : (
                  <Text type="secondary" style={{ fontSize: 12 }} data-testid="graphql-explorer-hint">
                    {t('workbench.editors.graphql.explorer.emptyHint')}
                  </Text>
                )}
                <Divider style={{ margin: '8px 0 4px', minWidth: 0, width: 'min(100%, 320px)' }} />
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    columnGap: 20,
                    rowGap: 6,
                  }}
                >
                  {EXPLORER_LOCAL_SOURCES.map((source) => (
                    <Button
                      key={source}
                      type="link"
                      size="small"
                      icon={EXPLORER_LOCAL_SOURCE_ICONS[source]}
                      onClick={localSourceAction(source)}
                      style={EXPLORER_LINK_STYLE}
                      data-testid={`graphql-explorer-${source}`}
                    >
                      {localSourceLabel(source)}
                    </Button>
                  ))}
                </div>
                </div>
              </div>
            )}
          </Allotment.Pane>
          <Allotment.Pane minSize={240}>
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0 6px 8px' }}>
                <span style={{ flex: 1 }} />
                <CodeEditorActions target={queryActionsRef} language="graphql" />
                <EditorViewMenu wrap={wrap} onWrapChange={setWrapOverride} data-testid="graphql-editor-menu" />
              </div>
              <div style={{ flex: 1, minHeight: 120, display: 'flex', flexDirection: 'column', paddingLeft: 8 }}>
                <CodeEditor
                  language="graphql"
                  value={draft.query}
                  onChange={(query) => setDraft((d) => ({ ...d, query }))}
                  placeholder={t('workbench.editors.graphql.query.placeholder')}
                  fill
                  actions="external"
                  actionsRef={queryActionsRef}
                  wordWrapOverride={wordWrapOverride}
                  onEditorMount={(editor, monacoApi) => {
                    editorRef.current = editor;
                    monacoRef.current = monacoApi;
                    servicesRef.current?.dispose();
                    const services = attachGraphqlEditorServices(editor, monacoApi);
                    services.setSchema(schemaRef.current);
                    servicesRef.current = services;
                    // The user's own navigation only — typing, a builder
                    // edit and a value swap move the cursor for other reasons.
                    const cursor = editor.onDidChangeCursorPosition((event) => {
                      if (event.reason !== monacoApi.editor.CursorChangeReason.Explicit) return;
                      const model = editor.getModel();
                      if (model !== null) followCursor(model.getOffsetAt(event.position));
                    });
                    editor.onDidDispose(() => {
                      cursor.dispose();
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
                  {variablesOpen && <CodeEditorActions target={variablesActionsRef} language="json" />}
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
                      actions="external"
                      actionsRef={variablesActionsRef}
                      wordWrapOverride={wordWrapOverride}
                    />
                  </div>
                )}
              </div>
            </div>
          </Allotment.Pane>
        </Allotment>
      </div>
    </div>
  );
};

export default GraphqlQueryTab;
