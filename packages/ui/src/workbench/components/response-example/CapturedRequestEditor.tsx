/**
 * CapturedRequestEditor — the request half of the example editor:
 * method + URL line, params/headers grids, and the body. Everything
 * edits the captured value in place (an example doubles as an authored
 * template); auth and scripts never appear — the capture doesn't hold
 * them and an example never runs.
 *
 * The URL and the params grid edit independently (no URL↔params
 * folding like the live request editor) — they document what was sent,
 * each field faithful to its stored value.
 */

import type { CapturedRequest, QueryParam, RequestHeader } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { Input, Select, Typography, theme } from 'antd';
import type React from 'react';
import CodeEditor from '../shared/CodeEditor';
import type { LanguageId } from '../../languages/registry';
import { METHOD_COLORS } from '../sidebar/icons';
import EditableKVGrid, { SectionLabel } from './EditableKVGrid';

const { Text } = Typography;

const monoFont: React.CSSProperties = {
  fontFamily: "'SF Mono', 'Fira Code', monospace",
  fontSize: 12,
};

const STANDARD_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;

type CapturedBody = CapturedRequest['body'];
type BodyTypeChoice = CapturedBody['type'];

/** Body types the editor can author. Multipart stays display-only —
 *  file parts reference uploaded blobs an example can't mint. */
const BODY_TYPE_OPTIONS: readonly { value: BodyTypeChoice; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'json', label: 'JSON' },
  { value: 'xml', label: 'XML' },
  { value: 'text', label: 'Text' },
  { value: 'graphql', label: 'GraphQL' },
  { value: 'form', label: 'Form' },
];

const BODY_LANGUAGE: Partial<Record<BodyTypeChoice, LanguageId>> = {
  json: 'json',
  xml: 'xml',
  text: 'text',
  graphql: 'graphql',
};

/** Carry text content across a body-type switch; other shapes reset. */
function switchBodyType(prev: CapturedBody, next: BodyTypeChoice): CapturedBody {
  if (next === prev.type) return prev;
  const prevText = 'content' in prev ? prev.content : '';
  switch (next) {
    case 'none':
      return { type: 'none' };
    case 'json':
      return { type: 'json', content: prevText };
    case 'xml':
      return { type: 'xml', content: prevText };
    case 'text':
      return { type: 'text', content: prevText };
    case 'graphql':
      return { type: 'graphql', content: prevText };
    case 'form':
      return { type: 'form', formParts: [] };
    case 'multipart':
      return { type: 'multipart', multipartParts: [] };
  }
}

interface CapturedRequestEditorProps {
  value: CapturedRequest;
  onChange: (next: CapturedRequest) => void;
}

const CapturedRequestEditor: React.FC<CapturedRequestEditorProps> = ({ value, onChange }) => {
  const { token } = theme.useToken();
  const patch = (p: Partial<CapturedRequest>) => onChange({ ...value, ...p });

  // The captured method may be a custom verb — keep it selectable.
  const methodOptions = [
    ...STANDARD_METHODS.map((m) => ({ value: m as string })),
    ...(STANDARD_METHODS.includes(value.method as (typeof STANDARD_METHODS)[number]) ? [] : [{ value: value.method }]),
  ].map((o) => ({
    value: o.value,
    label: (
      <span style={{ fontWeight: 700, fontSize: 12, color: METHOD_COLORS[o.value] ?? token.colorText }}>{o.value}</span>
    ),
  }));

  const body = value.body;
  const bodyLanguage = BODY_LANGUAGE[body.type];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <Select
          size="small"
          value={value.method}
          options={methodOptions}
          onChange={(method) => patch({ method })}
          style={{ width: 96, flexShrink: 0 }}
          popupMatchSelectWidth={false}
        />
        <Input
          size="small"
          value={value.url}
          placeholder="URL"
          onChange={(e) => patch({ url: e.target.value })}
          style={{ ...monoFont, flex: 1, minWidth: 0 }}
        />
      </div>
      <SectionLabel>Params ({value.params.length})</SectionLabel>
      <EditableKVGrid<QueryParam>
        rows={value.params}
        onChange={(params) => patch({ params })}
        makeRow={(key, v) => ({ uid: generateUid(), key, value: v, enabled: true })}
      />
      <SectionLabel>Headers ({value.headers.length})</SectionLabel>
      <EditableKVGrid<RequestHeader>
        rows={value.headers}
        onChange={(headers) => patch({ headers })}
        makeRow={(key, v) => ({ uid: generateUid(), key, value: v, enabled: true })}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <SectionLabel>Body</SectionLabel>
        <Select
          size="small"
          value={body.type}
          options={[
            ...BODY_TYPE_OPTIONS,
            ...(body.type === 'multipart' ? [{ value: 'multipart' as const, label: 'Multipart' }] : []),
          ]}
          onChange={(next) => patch({ body: switchBodyType(body, next) })}
          style={{ width: 110 }}
          popupMatchSelectWidth={false}
        />
      </div>
      {bodyLanguage && 'content' in body && (
        <div style={{ height: 160, border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 4 }}>
          <CodeEditor
            value={body.content}
            language={bodyLanguage}
            onChange={(content) => patch({ body: { ...body, content } })}
            fill
            variableAutoComplete={false}
          />
        </div>
      )}
      {body.type === 'graphql' && (
        <>
          <SectionLabel>GraphQL variables</SectionLabel>
          <div style={{ height: 90, border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 4 }}>
            <CodeEditor
              value={body.graphqlVariables ?? ''}
              language="json"
              onChange={(graphqlVariables) => patch({ body: { ...body, graphqlVariables } })}
              fill
              variableAutoComplete={false}
            />
          </div>
        </>
      )}
      {body.type === 'form' && (
        <EditableKVGrid
          rows={body.formParts}
          onChange={(formParts) => patch({ body: { ...body, formParts } })}
          makeRow={(key, v) => ({ uid: generateUid(), key, value: v, enabled: true })}
        />
      )}
      {body.type === 'multipart' && (
        <Text type="secondary" style={{ fontSize: 11 }}>
          Multipart parts are shown as captured ({body.multipartParts.length}); switch the body type to author a
          different shape.
        </Text>
      )}
    </div>
  );
};

export default CapturedRequestEditor;
