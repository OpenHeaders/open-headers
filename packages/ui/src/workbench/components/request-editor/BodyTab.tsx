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
 * Schema mapping (matches the `RequestBody` discriminated union):
 *   - none                  → `{ type: 'none' }`
 *   - form-data             → `{ type: 'multipart', multipartParts }`
 *   - x-www-form-urlencoded → `{ type: 'form', formParts }`
 *   - raw (Text/JS/HTML)    → `{ type: 'text', content, rawFormat? }`
 *   - raw (JSON)            → `{ type: 'json', content }`
 *   - raw (XML)             → `{ type: 'xml', content }`
 *   - GraphQL               → `{ type: 'graphql', content, graphqlVariables? }`
 *
 * Cross-toggle draft preservation: the persisted body only carries the
 * fields its variant declares (e.g. switching from raw → form drops
 * `content` from the persisted shape because the form variant doesn't
 * have a `content` field). To avoid losing the user's unsaved raw text
 * when they ping-pong between encodings, the editor stashes a snapshot
 * of each visited variant in component state and replays it on
 * re-entry — purely local UI state, never persisted.
 */

import { AlignLeftOutlined } from '@ant-design/icons';
import type { RequestBody } from '@openheaders/core/types';
import { Button, Radio, Select, Tooltip, Typography, theme } from 'antd';
import type * as monaco from 'monaco-editor';
import type React from 'react';
import { useMemo, useRef } from 'react';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import CodeEditor from '../shared/CodeEditor';
import MultipartEditor from './MultipartEditor';
import FormEditor from './FormEditor';
import { ViewPickerIcon } from './response/ViewPickerIcons';

const { Text } = Typography;

type RawFormat = 'text' | 'javascript' | 'json' | 'html' | 'xml';

const RAW_FORMAT_OPTIONS: ReadonlyArray<{ value: RawFormat; label: string }> = [
  { value: 'text', label: 'Text' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'json', label: 'JSON' },
  { value: 'html', label: 'HTML' },
  { value: 'xml', label: 'XML' },
];
type RadioValue = 'none' | 'form-data' | 'form-urlencoded' | 'raw' | 'graphql';

interface BodyTabProps {
  body: RequestBody;
  onChange: (body: RequestBody) => void;
}

function classifyBody(body: RequestBody): { radio: RadioValue; raw: RawFormat } {
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
      // `rawFormat` persists the user's dropdown choice for the three
      // formats that all share `type: 'text'` at the wire level
      // (text / javascript / html). Without it, the classifier would
      // collapse every save back to 'text' and the dropdown would
      // reset on reload.
      return {
        radio: 'raw',
        raw: body.rawFormat === 'javascript' || body.rawFormat === 'html' ? body.rawFormat : 'text',
      };
  }
}

/**
 * Build the initial body for a freshly-picked radio variant. Used
 * when no draft for that variant has been visited yet during this
 * editor session.
 */
function freshBody(radio: RadioValue, raw: RawFormat): RequestBody {
  switch (radio) {
    case 'none':
      return { type: 'none' };
    case 'form-data':
      return { type: 'multipart', multipartParts: [] };
    case 'form-urlencoded':
      return { type: 'form', formParts: [] };
    case 'raw':
      return rawBodyOf(raw, '');
    case 'graphql':
      return { type: 'graphql', content: '' };
  }
}

function rawBodyOf(raw: RawFormat, content: string): RequestBody {
  switch (raw) {
    case 'json':
      return { type: 'json', content };
    case 'xml':
      return { type: 'xml', content };
    case 'text':
      return { type: 'text', content };
    case 'javascript':
    case 'html':
      return { type: 'text', content, rawFormat: raw };
  }
}

const BodyTab: React.FC<BodyTabProps> = ({ body, onChange }) => {
  const { token } = theme.useToken();
  const { radio, raw } = useMemo(() => classifyBody(body), [body]);

  // Per-radio draft cache: when the user toggles radio A → B → A, the
  // values they typed under A come back. The persisted shape carries
  // only the active variant; this ref is the editor-local memory of
  // the others. Cleared on unmount (component-scoped useRef).
  const draftCacheRef = useRef<Partial<Record<RadioValue, RequestBody>>>({});
  // Mounted Monaco instance of the raw-body editor — the Format button
  // in the picker row dispatches through it (same path as the editor's
  // own corner action and Shift+Alt+F).
  const rawEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  // Mirror the live body into the cache on every render so the active
  // variant's edits are captured for return-trips.
  draftCacheRef.current[radio] = body;

  const switchRadio = (next: RadioValue) => {
    if (next === radio) return;
    const cached = draftCacheRef.current[next];
    onChange(cached ?? freshBody(next, raw));
  };

  const switchRawFormat = (next: RawFormat) => {
    // Always emit a freshly-shaped raw body — switching json↔xml↔text
    // changes the discriminant so we can't `{...body, type}` here
    // without producing an invalid variant.
    const currentContent = body.type === 'json' || body.type === 'xml' || body.type === 'text' ? body.content : '';
    onChange(rawBodyOf(next, currentContent));
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
      {/* Fixed row height: the raw/GraphQL variants add a 24px Select /
          Beautify button next to the radios, so without a reserved
          height the row (and the editor below) jumps when switching
          encodings. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', minHeight: 28 }}>
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
            options={RAW_FORMAT_OPTIONS.map((opt) => ({
              value: opt.value,
              label: (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <ViewPickerIcon id={opt.value} size={14} />
                  {opt.label}
                </span>
              ),
            }))}
            style={{ width: 140 }}
            popupMatchSelectWidth={false}
          />
        )}
        {radio === 'raw' && raw !== 'text' && (
          <Tooltip title="Format" placement="top">
            <Button
              size="small"
              type="text"
              icon={<AlignLeftOutlined />}
              aria-label="Format body"
              style={{ marginLeft: 'auto' }}
              onClick={() => {
                void rawEditorRef.current?.getAction('editor.action.formatDocument')?.run();
              }}
            >
              Beautify
            </Button>
          </Tooltip>
        )}
      </div>

      {body.type === 'none' && (
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

      {body.type === 'multipart' && (
        <MultipartEditor
          parts={body.multipartParts}
          onChange={(parts) => onChange({ type: 'multipart', multipartParts: parts })}
        />
      )}

      {body.type === 'form' && (
        <FormEditor fields={body.formParts} onChange={(fields) => onChange({ type: 'form', formParts: fields })} />
      )}

      {(body.type === 'json' || body.type === 'xml' || body.type === 'text') && (
        <div style={{ minHeight: 240 }}>
          <CodeEditor
            value={body.content}
            onChange={(content) => onChange(rawBodyOf(raw, content))}
            language={rawLangForEditor}
            minHeight={240}
            valueDetection
            onEditorMount={(ed) => {
              rawEditorRef.current = ed;
            }}
          />
        </div>
      )}

      {body.type === 'graphql' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16,
            minHeight: 320,
          }}
        >
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
                Query
              </Text>
              <InfoTrigger
                content={{
                  title: 'GraphQL query',
                  summary:
                    'Sent as a plain POST with a JSON body of { query, variables }. Schema introspection and query autocomplete are not available yet.',
                }}
              />
            </div>
            <div style={{ flex: 1, minHeight: 300 }}>
              <CodeEditor
                value={body.content}
                onChange={(content) =>
                  onChange(
                    body.graphqlVariables !== undefined
                      ? { type: 'graphql', content, graphqlVariables: body.graphqlVariables }
                      : { type: 'graphql', content },
                  )
                }
                language="graphql"
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
              <InfoTrigger
                content={{
                  title: 'GraphQL variables',
                  summary: 'Define variables in JSON format to reference from the query (e.g. $id).',
                }}
              />
            </div>
            <div style={{ flex: 1, minHeight: 300 }}>
              <CodeEditor
                value={body.graphqlVariables ?? ''}
                onChange={(variables) =>
                  onChange({ type: 'graphql', content: body.content, graphqlVariables: variables })
                }
                language="json"
                minHeight={300}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BodyTab;
