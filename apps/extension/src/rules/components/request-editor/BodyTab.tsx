/**
 * BodyTab — request body editor. The top row is a radio-group picker
 * that mirrors the wire-level body encodings: none / form-data /
 * x-www-form-urlencoded / raw / GraphQL (binary is intentionally
 * omitted today — the request executor's multipart path already
 * covers the common binary-upload case via a `FileRef` part).
 *
 * When `raw` is picked, a secondary format dropdown (Text / JavaScript
 * / JSON / HTML / XML) drives the Monaco language. The dropdown only
 * changes how the body is SYNTAX-highlighted; the wire bytes are
 * whatever the user typed verbatim.
 *
 * Schema mapping:
 *   - none                  → `{ type: 'none' }`
 *   - form-data             → `{ type: 'multipart', multipartParts }`
 *   - x-www-form-urlencoded → `{ type: 'form', content }`
 *   - raw                   → `{ type: 'json' | 'xml' | 'text', content }`
 *     (`graphql` has its own top-level tab; the raw-format dropdown
 *     mirrors Text / JavaScript / JSON / HTML / XML in UI while the
 *     store-level body.type stays JSON / XML / Text.)
 *   - GraphQL               → `{ type: 'graphql', content, graphqlVariables }`
 */

import { InfoCircleOutlined, ReloadOutlined, WarningFilled } from '@ant-design/icons';
import type { V5 } from '@openheaders/core/types';
import { Input, Radio, Select, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import CodeEditor from '../CodeEditor';
import MultipartEditor from '../MultipartEditor';

const { Text } = Typography;

type RawFormat = 'text' | 'javascript' | 'json' | 'html' | 'xml';
type RadioValue = 'none' | 'form-data' | 'form-urlencoded' | 'raw' | 'graphql';

interface BodyTabProps {
  body: V5.RequestBody;
  onChange: (body: V5.RequestBody) => void;
}

function classifyBody(body: V5.RequestBody): { radio: RadioValue; raw: RawFormat } {
  switch (body.type) {
    case 'none':
      return { radio: 'none', raw: 'text' };
    case 'multipart':
      return { radio: 'form-data', raw: 'text' };
    case 'form':
      return { radio: 'form-urlencoded', raw: 'text' };
    case 'graphql':
      return { radio: 'graphql', raw: 'text' };
    case 'json':
      return { radio: 'raw', raw: 'json' };
    case 'xml':
      return { radio: 'raw', raw: 'xml' };
    case 'text':
      return { radio: 'raw', raw: 'text' };
  }
}

function rawFormatToBodyType(raw: RawFormat): V5.BodyType {
  switch (raw) {
    case 'json':
      return 'json';
    case 'xml':
      return 'xml';
    default:
      return 'text';
  }
}

const BodyTab: React.FC<BodyTabProps> = ({ body, onChange }) => {
  const { token } = theme.useToken();
  const { radio, raw } = useMemo(() => classifyBody(body), [body]);

  const switchRadio = (next: RadioValue) => {
    if (next === radio) return;
    switch (next) {
      case 'none':
        onChange({ type: 'none' });
        return;
      case 'form-data':
        onChange({ type: 'multipart', multipartParts: body.multipartParts ?? [] });
        return;
      case 'form-urlencoded':
        onChange({ type: 'form', content: body.content ?? '' });
        return;
      case 'raw':
        onChange({ type: 'text', content: body.content ?? '' });
        return;
      case 'graphql':
        onChange({
          type: 'graphql',
          content: body.content ?? '',
          graphqlVariables: body.graphqlVariables,
        });
        return;
    }
  };

  const switchRawFormat = (next: RawFormat) => {
    onChange({ type: rawFormatToBodyType(next), content: body.content ?? '' });
  };

  const rawLangForEditor: 'text' | 'json' | 'xml' | 'html' | 'javascript' = (() => {
    if (raw === 'html') return 'html';
    if (raw === 'javascript') return 'javascript';
    if (raw === 'json') return 'json';
    if (raw === 'xml') return 'xml';
    return 'text';
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <Radio.Group value={radio} onChange={(e) => switchRadio(e.target.value as RadioValue)}>
          <Radio value="none">none</Radio>
          <Radio value="form-data">form-data</Radio>
          <Radio value="form-urlencoded">x-www-form-urlencoded</Radio>
          <Radio value="raw">raw</Radio>
          <Radio value="graphql">GraphQL</Radio>
        </Radio.Group>
        {radio === 'raw' && (
          <Select
            size="small"
            value={raw}
            onChange={switchRawFormat}
            options={[
              { value: 'text', label: 'Text' },
              { value: 'javascript', label: 'JavaScript' },
              { value: 'json', label: 'JSON' },
              { value: 'html', label: 'HTML' },
              { value: 'xml', label: 'XML' },
            ]}
            style={{ width: 140 }}
            popupMatchSelectWidth={false}
          />
        )}
        {radio === 'graphql' && (
          <GraphqlSchemaToolbar
            mode="auto-fetch"
            onModeChange={() => {
              /* Reserved — schema fetching lands alongside GraphQL tooling. */
            }}
            onRefresh={() => {
              /* Reserved — schema refresh invokes the remote introspection call. */
            }}
            warning="Schema auto-fetch is not wired yet — GraphQL runs as a plain POST until introspection lands."
          />
        )}
      </div>

      {radio === 'none' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 0',
            color: token.colorTextTertiary,
            fontSize: 13,
          }}
        >
          This request does not have a body
        </div>
      )}

      {radio === 'form-data' && (
        <MultipartEditor
          parts={body.multipartParts ?? []}
          onChange={(parts) => onChange({ type: 'multipart', multipartParts: parts })}
        />
      )}

      {radio === 'form-urlencoded' && (
        <Input.TextArea
          value={body.content ?? ''}
          onChange={(e) => onChange({ type: 'form', content: e.target.value })}
          placeholder="key1=value1&key2=value2"
          autoSize={{ minRows: 6, maxRows: 18 }}
          style={{
            fontFamily: "'SF Mono', 'Fira Code', monospace",
            fontSize: 12,
            background: token.colorBgContainer,
          }}
        />
      )}

      {radio === 'raw' && (
        <div style={{ minHeight: 240 }}>
          <CodeEditor
            value={body.content ?? ''}
            onChange={(content) => onChange({ type: rawFormatToBodyType(raw), content })}
            language={rawLangForEditor}
            placeholder="Request body"
            minHeight={240}
          />
        </div>
      )}

      {radio === 'graphql' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16,
            minHeight: 320,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <Text
              strong
              style={{ fontSize: 11, letterSpacing: 0.5, color: token.colorTextSecondary, textTransform: 'uppercase' }}
            >
              Query
            </Text>
            <div style={{ flex: 1, minHeight: 300 }}>
              <CodeEditor
                value={body.content ?? ''}
                onChange={(content) => onChange({ type: 'graphql', content, graphqlVariables: body.graphqlVariables })}
                language="graphql"
                placeholder="query { field }"
                minHeight={300}
              />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Text
                strong
                style={{
                  fontSize: 11,
                  letterSpacing: 0.5,
                  color: token.colorTextSecondary,
                  textTransform: 'uppercase',
                }}
              >
                GraphQL Variables
              </Text>
              <Tooltip title="Define variables in JSON format to use in the query">
                <InfoCircleOutlined style={{ fontSize: 12, color: token.colorTextTertiary }} />
              </Tooltip>
            </div>
            <div style={{ flex: 1, minHeight: 300 }}>
              <CodeEditor
                value={body.graphqlVariables ?? ''}
                onChange={(variables) =>
                  onChange({ type: 'graphql', content: body.content ?? '', graphqlVariables: variables })
                }
                language="json"
                placeholder={'{\n  "id": "123"\n}'}
                minHeight={300}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface GraphqlSchemaToolbarProps {
  mode: 'auto-fetch' | 'no-schema';
  onModeChange: (next: 'auto-fetch' | 'no-schema') => void;
  onRefresh: () => void;
  warning?: string;
}

const GraphqlSchemaToolbar: React.FC<GraphqlSchemaToolbarProps> = ({ mode, onModeChange, onRefresh, warning }) => {
  const { token } = theme.useToken();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Select
        size="small"
        value={mode}
        onChange={onModeChange}
        options={[
          { value: 'auto-fetch', label: 'Auto Fetch' },
          { value: 'no-schema', label: 'No schema' },
        ]}
        style={{ width: 130, color: token.colorPrimary }}
        popupMatchSelectWidth={false}
      />
      <Tooltip title="Refresh schema">
        <ReloadOutlined onClick={onRefresh} style={{ color: token.colorTextTertiary, cursor: 'pointer' }} />
      </Tooltip>
      {warning && (
        <Tooltip title={warning}>
          <WarningFilled style={{ color: token.colorWarning }} />
        </Tooltip>
      )}
    </div>
  );
};

export default BodyTab;
