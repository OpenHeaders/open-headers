/**
 * GraphqlQueryTab — the Query tab: the EXPLORER pane on the left (the
 * CTA-scaffold empty state until the schema plane lands — introspect /
 * use a spec / import a schema, all three present and disabled-honest)
 * beside the QUERY EDITOR (Monaco `graphql` over our Monarch grammar,
 * diagnostics + completion bound to `@openheaders/core/graphql`, the
 * prettify glyph through the core printer) with the collapsible
 * VARIABLES drawer under it (Monaco JSON; "Generate variables" from the
 * selected operation's variable definitions, schema-free samples until
 * the schema plane lands). The explorer / editor split is the WS
 * compose recipe's Allotment.
 */

import {
  censusDocument,
  type DocumentNode,
  exampleVariables,
  type OperationDefinitionNode,
  parseDocument,
  printNode,
  selectedOperation,
} from '@openheaders/core/graphql';
import { CaretDownOutlined, CaretRightOutlined, FormatPainterOutlined } from '@ant-design/icons';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Allotment } from 'allotment';
import { Button, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import CodeEditor from '../shared/CodeEditor';
import type { GraphqlDraft } from './draft';
import { attachGraphqlEditorServices } from './graphql-editor-services';

const { Text } = Typography;

interface GraphqlQueryTabProps {
  draft: GraphqlDraft;
  setDraft: Dispatch<SetStateAction<GraphqlDraft>>;
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

/** Every explorer source, disabled until Phase D wires them — present so
 *  the affordance is visible, never a hidden button (the CTA-scaffold
 *  law). */
const EXPLORER_SOURCES = ['introspect', 'spec', 'import'] as const;

const GraphqlQueryTab: React.FC<GraphqlQueryTabProps> = ({ draft, setDraft }) => {
  const { token } = theme.useToken();
  const t = useT();
  const [variablesOpen, setVariablesOpen] = useState(() => draft.variables.trim() !== '');
  const servicesRef = useRef<{ dispose: () => void } | null>(null);

  // The parse the prettify and generate gestures read — recomputed per
  // keystroke like the markers, never persisted.
  const parsed = useMemo(() => parseDocument(draft.query), [draft.query]);
  const canPrettify = parsed.document !== null && draft.query.trim() !== '';
  const operation = useMemo(
    () => (parsed.document === null ? null : pickedOperation(parsed.document, draft.operationName)),
    [parsed.document, draft.operationName],
  );
  const canGenerate = operation !== null && operation.variableDefinitions.length > 0;

  const handlePrettify = useCallback(() => {
    if (parsed.document === null) return;
    const pretty = printNode(parsed.document);
    setDraft((d) => (d.query === pretty ? d : { ...d, query: pretty }));
  }, [parsed.document, setDraft]);

  const handleGenerate = useCallback(() => {
    if (operation === null) return;
    const variables = JSON.stringify(exampleVariables(operation, null), null, 2);
    setVariablesOpen(true);
    setDraft((d) => ({ ...d, variables }));
  }, [operation, setDraft]);

  const sourceLabel = (source: (typeof EXPLORER_SOURCES)[number]): string => {
    switch (source) {
      case 'introspect':
        return t('workbench.editors.graphql.explorer.introspect');
      case 'spec':
        return t('workbench.editors.graphql.explorer.useSpec');
      case 'import':
        return t('workbench.editors.graphql.explorer.importSchema');
    }
  };

  return (
    <div style={{ flex: 1, minHeight: 320, display: 'flex' }} data-testid="graphql-query-tab">
      <Allotment proportionalLayout separator>
        <Allotment.Pane minSize={160} preferredSize="30%">
          {/* The explorer's empty state — the reference's CTA trio in our
            scaffold idiom: the fact, the hint, three actions that name
            the slice they land with. */}
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
              {EXPLORER_SOURCES.map((source) => (
                <Tooltip key={source} title={t('workbench.editors.graphql.explorer.landsWithSchema')}>
                  <span style={{ display: 'inline-flex' }}>
                    <Button
                      type="link"
                      size="small"
                      disabled
                      style={{ fontSize: 12, padding: 0, height: 'auto' }}
                      data-testid={`graphql-explorer-${source}`}
                    >
                      {sourceLabel(source)}
                    </Button>
                  </span>
                </Tooltip>
              ))}
            </div>
          </div>
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
                  servicesRef.current?.dispose();
                  servicesRef.current = attachGraphqlEditorServices(editor, monacoApi);
                  editor.onDidDispose(() => {
                    servicesRef.current?.dispose();
                    servicesRef.current = null;
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
