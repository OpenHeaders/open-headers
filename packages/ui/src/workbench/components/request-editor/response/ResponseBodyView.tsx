/**
 * ResponseBodyView — the response body pane.
 *
 * Three view modes behind a segmented control:
 *   • Pretty — read-only Monaco with syntax highlighting; language
 *     auto-detected from Content-Type with a manual override picker.
 *     JSON re-indents, everything else renders highlighted verbatim.
 *   • Raw — the wire text verbatim in a plain <pre>. Cheap for large
 *     bodies, and the element e2e reads (`oh-response-body`).
 *   • Preview — HTML responses rendered in a fully sandboxed iframe
 *     (no scripts, no same-origin access). Offered only when the
 *     viewer language is HTML.
 */

import { CheckOutlined, CopyOutlined } from '@ant-design/icons';
import type { ExecutedRequestSnapshot } from '@openheaders/core/types';
import { Button, Segmented, Select, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { LANGUAGE_LIST, type LanguageId } from '../../../languages/registry';
import CodeEditor from '../../shared/CodeEditor';
import { detectBodyLanguage, formatBytes, prettyBody } from './response-format';

const { Text } = Typography;

/** Body cap the runner applies before truncating — surfaced in the
 *  truncation notice. */
const BODY_CAP_BYTES = 2 * 1024 * 1024;

type ViewMode = 'pretty' | 'raw' | 'preview';

/** Override picker entries — every registry language a response body
 *  can plausibly be, i.e. all but graphql (no response media type and
 *  no Monaco grammar). */
const LANGUAGE_OPTIONS = LANGUAGE_LIST.filter((l) => l.id !== 'graphql').map((l) => ({
  value: l.id,
  label: l.label,
}));

const ResponseBodyView: React.FC<{ response: ExecutedRequestSnapshot }> = ({ response }) => {
  const { token } = theme.useToken();
  const [mode, setMode] = useState<ViewMode>('pretty');
  const [langOverride, setLangOverride] = useState<LanguageId | null>(null);
  const [copied, setCopied] = useState(false);

  // Each new response re-detects: a JSON override on the previous send
  // must not stick to the HTML page the next send returned.
  useEffect(() => {
    setMode('pretty');
    setLangOverride(null);
  }, [response]);

  const language = langOverride ?? detectBodyLanguage(response.headers);
  const pretty = useMemo(() => prettyBody(response.body, language), [response.body, language]);

  const copyBody = () => {
    void navigator.clipboard.writeText(response.body).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  if (!response.body) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Empty body
        </Text>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', paddingBottom: 8 }}>
      {response.bodyTruncated && (
        <Text type="warning" style={{ fontSize: 11, display: 'block', marginTop: 6 }}>
          Response truncated at {formatBytes(BODY_CAP_BYTES)} (original {formatBytes(response.bodyBytes)}).
        </Text>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
        <Segmented
          size="small"
          value={mode}
          onChange={(next) => setMode(next as ViewMode)}
          options={[
            { label: 'Pretty', value: 'pretty' },
            { label: 'Raw', value: 'raw' },
            ...(language === 'html' ? [{ label: 'Preview', value: 'preview' }] : []),
          ]}
        />
        {mode === 'pretty' && (
          <Select
            size="small"
            aria-label="Body format"
            value={language}
            onChange={(next: LanguageId) => setLangOverride(next)}
            options={LANGUAGE_OPTIONS}
            style={{ width: 110 }}
            popupMatchSelectWidth={false}
          />
        )}
        <Tooltip title={copied ? 'Copied' : 'Copy body'} placement="bottom">
          <Button
            size="small"
            type="text"
            icon={copied ? <CheckOutlined /> : <CopyOutlined />}
            onClick={copyBody}
            aria-label="Copy body"
            style={{ marginLeft: 'auto' }}
          />
        </Tooltip>
      </div>
      {mode === 'pretty' && (
        <div style={{ flex: 1, minHeight: 0 }}>
          <CodeEditor value={pretty} language={language} readOnly fill variableAutoComplete={false} />
        </div>
      )}
      {mode === 'raw' && (
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          <pre
            // Role-less rendered body — same exception as the status chip:
            // a single inline test id so e2e can read the wire text
            // directly instead of sniffing the DOM for a JSON-shaped <pre>.
            data-testid="oh-response-body"
            style={{
              fontFamily: "'SF Mono', 'Fira Code', monospace",
              fontSize: 12,
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: token.colorText,
            }}
          >
            {response.body}
          </pre>
        </div>
      )}
      {mode === 'preview' && (
        <iframe
          title="Response preview"
          sandbox=""
          srcDoc={response.body}
          style={{
            flex: 1,
            width: '100%',
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: 6,
            // Pages assume a light canvas; don't paint them on the
            // app's dark background.
            background: '#fff',
          }}
        />
      )}
    </div>
  );
};

export default ResponseBodyView;
