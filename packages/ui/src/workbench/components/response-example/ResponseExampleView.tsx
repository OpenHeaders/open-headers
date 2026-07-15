/**
 * ResponseExampleView — editor tab for a saved response example.
 *
 * An example starts as a capture of one executed exchange and stays
 * editable afterwards: it doubles as an authored documentation
 * template. The surface deliberately mirrors the request editor —
 * same URL bar in the header, same Params/Headers/Body tabbed grids,
 * same request/response Allotment split with the shared orientation
 * preference — narrowed to what an example holds: no Docs, Auth,
 * Scripts, or Settings tabs (the capture excludes those and an example
 * never runs), and the response half's meta is editable (status code,
 * status text, final URL). Running the shape goes through "Open as
 * Request", which forks the current draft into a fresh scratch.
 *
 * Editor mechanics follow the house recipe: draft state, structural
 * dirty via `useReprime` (uid-free fingerprints — see example-draft),
 * Save through the response-example write client (each captured block
 * patches as one LWW value), shell wiring via `useEditorShell`.
 */

import { ExportOutlined, LoadingOutlined } from '@ant-design/icons';
import { RESPONSE_EXAMPLE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { Request, ResponseExample } from '@openheaders/core/types';
import { Allotment } from 'allotment';
import { App, Button, Tabs, Tooltip, Typography } from 'antd';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { EntityScopeProvider } from '@openheaders/ui/shared/awareness';
import { useEditorShell, useReprime } from '@openheaders/ui/shared/editor-shell';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { useResponseExample } from '@openheaders/ui/shared/hooks/readers/useResponseExamples';
import { applyResponseExampleUpdate } from '@openheaders/ui/shared/sync/response-example-write-client';
import EditorHeader from '../shell/EditorHeader';
import type { Draft } from '../request-editor/draft';
import { type TabKey, buildRequestTabItems } from '../request-editor/request-tab-items';
import RequestTabContent from '../request-editor/RequestTabContent';
import RequestUrlBar from '../request-editor/RequestUrlBar';
import { useRequestEditorLayout } from '../request-editor/useRequestEditorLayout';
import type { SectionUnresolved } from '../request-editor/useSectionUnresolved';
import {
  type ExampleDraft,
  capturedRequestFromDraft,
  capturedResponseFromDraft,
  exampleDraftFingerprint,
  exampleSignature,
  exampleToDraft,
} from './example-draft';
import ExampleResponsePanel from './ExampleResponsePanel';

const { Text } = Typography;

/** Example content is authored literal values — the unresolved-ref
 *  plumbing never applies, so every section reads resolved. */
const NO_UNRESOLVED: SectionUnresolved = { url: false, params: false, headers: false, auth: false, body: false };

/** The request-editor tabs an example carries content for. */
const EXAMPLE_TAB_KEYS: readonly TabKey[] = ['params', 'headers', 'body'];

function buildTrySeed(draft: ExampleDraft, requestName: string): Omit<Request, 'uid' | 'path' | 'schemaVersion'> {
  const captured = capturedRequestFromDraft(draft.request);
  return {
    name: requestName,
    method: captured.method,
    url: captured.url,
    headers: captured.headers,
    params: captured.params,
    // The capture holds no auth (secrets never ride examples) — the
    // fork starts on the collection/folder default like a new request.
    auth: { type: 'inherit' },
    body: captured.body,
  };
}

interface ResponseExampleViewProps {
  exampleUid: string;
  workspaceId: string | null;
  /** "Open as Request" — fork the example's current request shape into
   *  a fresh scratch draft. `content` is the seeded draft; `exampleName`
   *  rides the new tab as chrome-only provenance. */
  onTry: (content: Omit<Request, 'uid' | 'path' | 'schemaVersion'>, exampleName: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
}

const ResponseExampleView: React.FC<ResponseExampleViewProps> = ({
  exampleUid,
  workspaceId,
  onTry,
  onDirtyChange,
  registerSaveRef,
}) => {
  const { message } = App.useApp();
  const t = useT();
  const { example, hydrated } = useResponseExample(workspaceId, exampleUid);
  const { requests } = useRequests();

  const parentRequest = useMemo(
    () => (example ? (requests.find((r) => r.uid === example.requestUid) ?? null) : null),
    [requests, example],
  );

  const [draft, setDraft] = useState<ExampleDraft | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('params');
  const [layout, setLayout] = useRequestEditorLayout();

  // Adapter so the request editor's own components (URL bar, tab
  // panes), which speak `Dispatch<SetStateAction<Draft>>`, edit the
  // request half of the example draft in place.
  const setRequestDraft = useCallback<React.Dispatch<React.SetStateAction<Draft>>>((action) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const request = typeof action === 'function' ? action(prev.request) : action;
      return { ...prev, request };
    });
  }, []);

  const reprime = useReprime<ResponseExample>({
    liveEntity: example,
    scope: { entityType: RESPONSE_EXAMPLE_ENTITY_TYPE, entityId: exampleUid },
    enabled: hydrated,
    formFingerprint: draft ? exampleDraftFingerprint(draft) : '',
    signature: exampleSignature,
    populate: (e) => setDraft(exampleToDraft(e)),
  });
  const isDirty = reprime.isDirty;

  const handleSave = useCallback(async () => {
    if (!draft || !example || !workspaceId || !isDirty) return;
    const result = await applyResponseExampleUpdate(
      exampleUid,
      {
        request: capturedRequestFromDraft(draft.request),
        response: capturedResponseFromDraft(draft.response, example.response),
      },
      { workspaceId, surfaceId: 'workbench' },
    );
    if (!result.ok) {
      if (result.reason === 'not-found') message.error(t('workbench.editors.responseExample.toast.deletedOtherTab'));
      else if ('message' in result && result.message)
        message.error(t('workbench.editors.responseExample.toast.saveFailedDetail', { message: result.message }));
      else message.error(t('workbench.editors.responseExample.toast.saveFailed'));
    }
  }, [draft, example, workspaceId, isDirty, exampleUid, message, t]);

  const handleSaveSync = useCallback(() => {
    void handleSave();
  }, [handleSave]);

  const shell = useEditorShell({
    entityType: RESPONSE_EXAMPLE_ENTITY_TYPE,
    entityId: example?.uid ?? null,
    isDirty,
    onSave: handleSaveSync,
    onDirtyChange,
    registerSaveRef,
  });

  if (!hydrated || (example && !draft)) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Text type="secondary">
          <LoadingOutlined style={{ marginRight: 6 }} />
          {t('workbench.editors.responseExample.loading')}
        </Text>
      </div>
    );
  }

  if (!example || !draft) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Text type="secondary">{t('workbench.editors.responseExample.notFound')}</Text>
      </div>
    );
  }

  const tabItems = buildRequestTabItems(draft.request, NO_UNRESOLVED, t).filter((item) =>
    EXAMPLE_TAB_KEYS.includes(item.key),
  );

  return (
    <EntityScopeProvider shell={shell.scopeProps}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <EditorHeader
          title={
            <RequestUrlBar draft={draft.request} setDraft={setRequestDraft} urlUnresolved={false} onSend={() => {}} />
          }
          actions={
            <Tooltip title={t('workbench.editors.responseExample.openAsRequestTooltip')} placement="bottom">
              <Button
                size="small"
                type="primary"
                icon={<ExportOutlined />}
                onClick={() => onTry(buildTrySeed(draft, parentRequest?.name ?? example.name), example.name)}
              >
                {t('workbench.editors.responseExample.openAsRequest')}
              </Button>
            </Tooltip>
          }
          shell={shell.headerProps}
        />
        <div style={{ flex: 1, minHeight: 0 }}>
          <Allotment key={layout} vertical={layout === 'vertical'} proportionalLayout separator>
            <Allotment.Pane minSize={layout === 'vertical' ? 140 : 320} preferredSize="55%">
              <div
                className="rules-thin-scrollbar"
                style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}
              >
                <div style={{ padding: '8px 16px 0' }}>
                  <Tabs
                    size="small"
                    activeKey={activeTab}
                    onChange={(k) => setActiveTab(k as TabKey)}
                    items={tabItems}
                    className="rules-request-tabs"
                    tabBarStyle={{ marginBottom: 0 }}
                  />
                </div>
                <div style={{ flex: 1, overflow: 'auto', overscrollBehavior: 'none', padding: '0 16px' }}>
                  <div style={{ padding: '10px 0' }}>
                    <RequestTabContent tab={activeTab} draft={draft.request} setDraft={setRequestDraft} />
                  </div>
                </div>
              </div>
            </Allotment.Pane>
            <Allotment.Pane minSize={layout === 'vertical' ? 120 : 280}>
              <ExampleResponsePanel
                value={draft.response}
                onChange={(response) => setDraft({ ...draft, response })}
                meta={{
                  bodyBytes: example.response.bodyBytes,
                  durationMs: example.response.durationMs,
                  bodyTruncated: example.response.bodyTruncated,
                  bodyCapBytes: example.response.bodyCapBytes,
                }}
                capturedAt={example.capturedAt}
                layout={layout}
                onLayoutChange={setLayout}
              />
            </Allotment.Pane>
          </Allotment>
        </div>
      </div>
    </EntityScopeProvider>
  );
};

export default ResponseExampleView;
