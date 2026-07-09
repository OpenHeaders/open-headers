/**
 * ResponseExampleView — editor tab for a saved response example.
 *
 * An example starts as a capture of one executed exchange and stays
 * editable afterwards: the captured request (method, URL, params,
 * headers, body) and response (status, headers, body) are authored
 * content, so a real exchange can be reworked into a documentation
 * template. `capturedAt` stays the historical capture moment; auth and
 * scripts never appear — the capture doesn't hold them and an example
 * never runs. Running it goes through "Try", which forks the example's
 * current request shape into a fresh scratch draft.
 *
 * Editor mechanics follow the house recipe: draft state, structural
 * dirty via `useReprime` (form-vs-canonical fingerprints), Save through
 * the response-example write client (each captured block patches as one
 * LWW value), shell wiring via `useEditorShell`.
 */

import { ExportOutlined, LoadingOutlined } from '@ant-design/icons';
import { RESPONSE_EXAMPLE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { CapturedRequest, CapturedResponse, Request, ResponseExample } from '@openheaders/core/types';
import { App, Button, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { EntityScopeProvider } from '@openheaders/ui/shared/awareness';
import { useEditorShell, useReprime } from '@openheaders/ui/shared/editor-shell';
import { stableStringify } from '@openheaders/ui/shared/forms';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { useResponseExample } from '@openheaders/ui/shared/hooks/readers/useResponseExamples';
import { applyResponseExampleUpdate } from '@openheaders/ui/shared/sync/response-example-write-client';
import EditorHeader from '../shell/EditorHeader';
import CapturedRequestEditor from './CapturedRequestEditor';
import CapturedResponseEditor from './CapturedResponseEditor';

const { Text } = Typography;

interface ExampleDraft {
  request: CapturedRequest;
  response: CapturedResponse;
}

const cloneDraft = (example: ResponseExample): ExampleDraft =>
  JSON.parse(JSON.stringify({ request: example.request, response: example.response })) as ExampleDraft;

const draftSignature = (example: ResponseExample): string =>
  stableStringify({ request: example.request, response: example.response });

/**
 * Byte-accurate size for the edited body. An edited body is exactly
 * what's stored — clear any capture-time truncation stamp with it.
 */
function withRecomputedBodyMeta(response: CapturedResponse, canonical: CapturedResponse): CapturedResponse {
  if (response.body === canonical.body) return response;
  const next: CapturedResponse = {
    ...response,
    bodyBytes: new TextEncoder().encode(response.body).length,
    bodyTruncated: false,
  };
  delete next.bodyCapBytes;
  return next;
}

function buildTrySeed(draft: ExampleDraft, requestName: string): Omit<Request, 'uid' | 'path' | 'schemaVersion'> {
  return {
    name: requestName,
    method: draft.request.method,
    url: draft.request.url,
    headers: draft.request.headers,
    params: draft.request.params,
    // The capture holds no auth (secrets never ride examples) — the
    // fork starts on the collection/folder default like a new request.
    auth: { type: 'inherit' },
    body: draft.request.body,
  };
}

interface ResponseExampleViewProps {
  exampleUid: string;
  workspaceId: string | null;
  /** "Try" — fork the example's current request shape into a fresh
   *  scratch draft. `content` is the seeded draft; `exampleName` rides
   *  the new tab as chrome-only provenance. */
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
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { example, hydrated } = useResponseExample(workspaceId, exampleUid);
  const { requests } = useRequests();

  const parentRequest = useMemo(
    () => (example ? (requests.find((r) => r.uid === example.requestUid) ?? null) : null),
    [requests, example],
  );

  const [draft, setDraft] = useState<ExampleDraft | null>(null);

  const reprime = useReprime<ResponseExample>({
    liveEntity: example,
    scope: { entityType: RESPONSE_EXAMPLE_ENTITY_TYPE, entityId: exampleUid },
    enabled: hydrated,
    formFingerprint: draft ? stableStringify(draft) : '',
    signature: draftSignature,
    populate: (e) => setDraft(cloneDraft(e)),
  });
  const isDirty = reprime.isDirty;

  const handleSave = useCallback(async () => {
    if (!draft || !example || !workspaceId || !isDirty) return;
    const result = await applyResponseExampleUpdate(
      exampleUid,
      {
        request: draft.request,
        response: withRecomputedBodyMeta(draft.response, example.response),
      },
      { workspaceId, surfaceId: 'workbench' },
    );
    if (!result.ok) {
      if (result.reason === 'not-found') message.error('Example was deleted from another tab');
      else message.error(`Failed to save example${'message' in result && result.message ? `: ${result.message}` : ''}`);
    }
  }, [draft, example, workspaceId, isDirty, exampleUid, message]);

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
          Loading example…
        </Text>
      </div>
    );
  }

  if (!example || !draft) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Text type="secondary">Example not found.</Text>
      </div>
    );
  }

  const capturedAt = new Date(example.capturedAt);

  return (
    <EntityScopeProvider shell={shell.scopeProps}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <EditorHeader
          title={
            <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
              <span
                style={{
                  fontFamily: "'SF Mono', monospace",
                  fontSize: 9,
                  fontWeight: 700,
                  color: token.colorTextTertiary,
                }}
              >
                e.g.
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {example.name}
              </span>
              <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                {parentRequest ? `${parentRequest.name} · ` : ''}
                captured {Number.isNaN(capturedAt.getTime()) ? example.capturedAt : capturedAt.toLocaleString()}
              </Text>
            </span>
          }
          actions={
            <Tooltip title="Fork this example's request into a new draft" placement="bottom">
              <Button
                size="small"
                type="primary"
                icon={<ExportOutlined />}
                onClick={() => onTry(buildTrySeed(draft, parentRequest?.name ?? example.name), example.name)}
              >
                Try
              </Button>
            </Tooltip>
          }
          shell={shell.headerProps}
        />
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 16px 12px', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
            <CapturedRequestEditor value={draft.request} onChange={(request) => setDraft({ ...draft, request })} />
          </div>
          <div style={{ padding: '10px 16px 12px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <CapturedResponseEditor value={draft.response} onChange={(response) => setDraft({ ...draft, response })} />
          </div>
        </div>
      </div>
    </EntityScopeProvider>
  );
};

export default ResponseExampleView;
