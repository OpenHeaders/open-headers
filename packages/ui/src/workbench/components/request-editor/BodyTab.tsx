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

import type { RequestBody } from '@openheaders/core/types';
import { Radio, Select, Typography, theme } from 'antd';
import type React from 'react';
import { useMemo, useRef } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import CodeEditor from '../shared/CodeEditor';
import CodeEditorActions, { type CodeEditorActionsTarget } from '../shared/CodeEditorActions';
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
  const t = useT();
  const { radio, raw } = useMemo(() => classifyBody(body), [body]);

  // Per-radio draft cache: when the user toggles radio A → B → A, the
  // values they typed under A come back. The persisted shape carries
  // only the active variant; this ref is the editor-local memory of
  // the others. Cleared on unmount (component-scoped useRef).
  const draftCacheRef = useRef<Partial<Record<RadioValue, RequestBody>>>({});
  // Action surfaces of the mounted editors — the Find / Replace /
  // Beautify clusters live in the rows ABOVE the editors (`actions=
  // "external"`), so they never cover long first lines of the buffer.
  const rawActionsRef = useRef<CodeEditorActionsTarget | null>(null);
  const graphqlQueryActionsRef = useRef<CodeEditorActionsTarget | null>(null);
  const graphqlVariablesActionsRef = useRef<CodeEditorActionsTarget | null>(null);
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 0 }}>
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
        {radio === 'raw' && (
          <CodeEditorActions
            target={rawActionsRef}
            language={rawLangForEditor}
            formatText={t('workbench.editors.request.body.beautify')}
            style={{ marginLeft: 'auto' }}
          />
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
          {t('workbench.editors.request.body.noBody')}
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
        // Absolute inset host — see ScriptsTab: a fill editor must not
        // contribute intrinsic height or Monaco's inline height ratchets
        // the scroller's content size and the pane never shrinks back.
        <div style={{ flex: 1, minHeight: 100, position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
            <CodeEditor
              value={body.content}
              onChange={(content) => onChange(rawBodyOf(raw, content))}
              language={rawLangForEditor}
              fill
              valueDetection
              actions="external"
              actionsRef={rawActionsRef}
            />
          </div>
        </div>
      )}

      {body.type === 'graphql' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16,
            flex: 1,
            minHeight: 160,
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
                {t('workbench.editors.request.body.queryTitle')}
              </Text>
              <InfoTrigger
                content={{
                  title: t('workbench.editors.request.body.queryInfoTitle'),
                  summary: t('workbench.editors.request.body.queryInfoSummary'),
                }}
              />
              <CodeEditorActions target={graphqlQueryActionsRef} language="graphql" style={{ marginLeft: 'auto' }} />
            </div>
            <div style={{ flex: 1, minHeight: 100, position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
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
                  fill
                  actions="external"
                  actionsRef={graphqlQueryActionsRef}
                />
              </div>
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
                {t('workbench.editors.request.body.variablesTitle')}
              </Text>
              <InfoTrigger
                content={{
                  title: t('workbench.editors.request.body.variablesInfoTitle'),
                  summary: t('workbench.editors.request.body.variablesInfoSummary'),
                }}
              />
              <CodeEditorActions target={graphqlVariablesActionsRef} language="json" style={{ marginLeft: 'auto' }} />
            </div>
            <div style={{ flex: 1, minHeight: 100, position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
                <CodeEditor
                  value={body.graphqlVariables ?? ''}
                  onChange={(variables) =>
                    onChange({ type: 'graphql', content: body.content, graphqlVariables: variables })
                  }
                  language="json"
                  fill
                  actions="external"
                  actionsRef={graphqlVariablesActionsRef}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BodyTab;
