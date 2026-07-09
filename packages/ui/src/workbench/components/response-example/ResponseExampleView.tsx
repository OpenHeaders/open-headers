/**
 * ResponseExampleView — read-only viewer tab for a saved response
 * example (a frozen snapshot of one executed exchange).
 *
 * Top: the captured request as sent — method + URL line, then compact
 * name/value grids for params/headers and the body text. No editable
 * grids and no auth/scripts sections: the capture never carried those,
 * and examples are immutable records (rename lives on the sidebar row;
 * content edits go through "Try", which forks the captured request
 * shape into a fresh scratch draft).
 *
 * Bottom: the captured response rendered with the same views the live
 * response panel uses (Body / Headers + meta strip), adapted through
 * `capturedResponseToSnapshot`. Cookies/Assertions/Console tabs never
 * appear — the capture holds no wire/script data to back them.
 */

import { ArrowUpOutlined, LoadingOutlined } from '@ant-design/icons';
import type { CapturedRequest, Request, ResponseExample } from '@openheaders/core/types';
import { Button, Tabs, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { useResponseExample } from '@openheaders/ui/shared/hooks/readers/useResponseExamples';
import EditorHeader from '../shell/EditorHeader';
import ResponseBodyView from '../request-editor/response/ResponseBodyView';
import ResponseHeadersView from '../request-editor/response/ResponseHeadersView';
import ResponseMetaStrip from '../request-editor/response/ResponseMetaStrip';
import { METHOD_COLORS } from '../sidebar/icons';
import { capturedResponseToSnapshot } from './captured-snapshot';

const { Text } = Typography;

const monoFont: React.CSSProperties = {
  fontFamily: "'SF Mono', 'Fira Code', monospace",
  fontSize: 12,
};

interface ResponseExampleViewProps {
  exampleUid: string;
  workspaceId: string | null;
  /** "Try" — fork the captured request shape into a fresh scratch
   *  draft. `content` is the seeded draft; `exampleName` rides the new
   *  tab as chrome-only provenance. */
  onTry: (content: Omit<Request, 'uid' | 'path' | 'schemaVersion'>, exampleName: string) => void;
}

/** Compact read-only name/value grid for captured params/headers/form
 *  fields. Disabled rows stay visible (the capture preserved them) but
 *  dimmed, matching the editable grids' off-row treatment. */
const CapturedKVGrid: React.FC<{ rows: Array<{ key: string; value: string; enabled?: boolean }> }> = ({ rows }) => {
  const { token } = theme.useToken();
  return (
    <div style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 4, overflow: 'hidden' }}>
      {rows.map((row, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: frozen capture rows are positional
          key={`${row.key}:${i}`}
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(140px, 1fr) 2fr',
            borderTop: i > 0 ? `1px solid ${token.colorBorderSecondary}` : undefined,
            opacity: row.enabled === false ? 0.5 : 1,
          }}
        >
          <span style={{ ...monoFont, padding: '3px 8px', fontWeight: 600, wordBreak: 'break-all' }}>{row.key}</span>
          <span
            style={{
              ...monoFont,
              padding: '3px 8px',
              borderLeft: `1px solid ${token.colorBorderSecondary}`,
              color: token.colorTextSecondary,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
};

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
    {children}
  </Text>
);

/** The captured body, faithful to its authored type: text-bearing
 *  bodies verbatim, structured bodies as grids, file parts by name. */
const CapturedBody: React.FC<{ body: CapturedRequest['body'] }> = ({ body }) => {
  const { token } = theme.useToken();
  if (body.type === 'none') return null;
  if (body.type === 'form') {
    return <CapturedKVGrid rows={body.formParts} />;
  }
  if (body.type === 'multipart') {
    return (
      <CapturedKVGrid
        rows={body.multipartParts.map((part) =>
          part.kind === 'text'
            ? { key: part.name, value: part.value, enabled: part.enabled }
            : {
                key: part.name,
                value: part.fileRefs.map((f) => f.filename).join(', ') || '(no files selected)',
                enabled: part.enabled,
              },
        )}
      />
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <pre
        style={{
          ...monoFont,
          margin: 0,
          padding: '6px 8px',
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 4,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          color: token.colorText,
        }}
      >
        {body.content}
      </pre>
      {body.type === 'graphql' && body.graphqlVariables && (
        <>
          <SectionLabel>GraphQL variables</SectionLabel>
          <pre
            style={{
              ...monoFont,
              margin: 0,
              padding: '6px 8px',
              border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: 4,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: token.colorText,
            }}
          >
            {body.graphqlVariables}
          </pre>
        </>
      )}
    </div>
  );
};

function buildTrySeed(example: ResponseExample, requestName: string): Omit<Request, 'uid' | 'path' | 'schemaVersion'> {
  return {
    name: requestName,
    method: example.request.method,
    url: example.request.url,
    headers: example.request.headers,
    params: example.request.params,
    // The capture holds no auth (secrets never ride examples) — the
    // fork starts on the collection/folder default like a new request.
    auth: { type: 'inherit' },
    body: example.request.body,
  };
}

const ResponseExampleView: React.FC<ResponseExampleViewProps> = ({ exampleUid, workspaceId, onTry }) => {
  const { token } = theme.useToken();
  const { example, hydrated } = useResponseExample(workspaceId, exampleUid);
  const { requests } = useRequests();

  const parentRequest = useMemo(
    () => (example ? (requests.find((r) => r.uid === example.requestUid) ?? null) : null),
    [requests, example],
  );

  const snapshot = useMemo(() => (example ? capturedResponseToSnapshot(example.response) : null), [example]);

  if (!hydrated) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Text type="secondary">
          <LoadingOutlined style={{ marginRight: 6 }} />
          Loading example…
        </Text>
      </div>
    );
  }

  if (!example || !snapshot) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Text type="secondary">Example not found.</Text>
      </div>
    );
  }

  const statusColor =
    snapshot.status >= 500
      ? token.colorError
      : snapshot.status >= 400
        ? token.colorWarning
        : snapshot.status >= 200 && snapshot.status < 300
          ? token.colorSuccess
          : token.colorTextSecondary;

  const methodColor = METHOD_COLORS[example.request.method] ?? token.colorText;
  const capturedAt = new Date(example.capturedAt);
  const capturedParams = example.request.params;
  const capturedHeaders = example.request.headers;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <EditorHeader
        title={
          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
            <span style={{ ...monoFont, fontSize: 9, fontWeight: 700, color: token.colorTextTertiary }}>e.g.</span>
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
          <Tooltip title="Fork this captured request into a new draft" placement="bottom">
            <Button
              size="small"
              type="primary"
              onClick={() => onTry(buildTrySeed(example, parentRequest?.name ?? example.name), example.name)}
            >
              Try
              <ArrowUpOutlined rotate={45} style={{ fontSize: 11 }} />
            </Button>
          </Tooltip>
        }
      />
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            flex: '0 1 auto',
            maxHeight: '45%',
            overflow: 'auto',
            padding: '10px 16px 12px',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
            <span style={{ ...monoFont, fontWeight: 700, color: methodColor, flexShrink: 0 }}>
              {example.request.method}
            </span>
            <span style={{ ...monoFont, color: token.colorTextSecondary, wordBreak: 'break-all' }}>
              {example.request.url || '(no URL)'}
            </span>
          </div>
          {capturedParams.length > 0 && (
            <>
              <SectionLabel>Params ({capturedParams.length})</SectionLabel>
              <CapturedKVGrid rows={capturedParams} />
            </>
          )}
          {capturedHeaders.length > 0 && (
            <>
              <SectionLabel>Headers ({capturedHeaders.length})</SectionLabel>
              <CapturedKVGrid rows={capturedHeaders} />
            </>
          )}
          {example.request.body.type !== 'none' && (
            <>
              <SectionLabel>Body</SectionLabel>
              <CapturedBody body={example.request.body} />
            </>
          )}
        </div>
        <Tabs
          size="small"
          className="rules-response-tabs"
          style={{ flex: 1, padding: '0 16px', display: 'flex', flexDirection: 'column', minHeight: 0 }}
          tabBarStyle={{ marginBottom: 0 }}
          tabBarExtraContent={{
            right: (
              <div style={{ display: 'inline-flex', alignItems: 'center', paddingLeft: 12 }}>
                <ResponseMetaStrip response={snapshot} statusColor={statusColor} />
              </div>
            ),
          }}
          items={[
            { key: 'body', label: 'Body', children: <ResponseBodyView response={snapshot} /> },
            {
              key: 'headers',
              label: `Headers (${snapshot.headers.length})`,
              children: <ResponseHeadersView headers={snapshot.headers} />,
            },
          ]}
        />
      </div>
    </div>
  );
};

export default ResponseExampleView;
