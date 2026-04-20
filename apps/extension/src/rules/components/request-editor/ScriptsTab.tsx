/**
 * ScriptsTab — lift the previous Pre-request / Post-response sibling
 * tabs into ONE tab with a left-rail picker + shared Monaco editor.
 * Matches the layout of a dedicated "Scripts" surface while keeping
 * both scripts editable in a single click.
 */

import type { ScriptKind } from '@openheaders/core/scripts';
import { Typography, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import ScriptEditor from '../script-editor/ScriptEditor';

const { Text } = Typography;

const SCRIPT_PLACEHOLDER: Record<ScriptKind, string> = {
  'pre-request':
    '// Runs before the request is sent.\n' +
    '// Use oh.setHeader, oh.setUrl, oh.setBody, etc. to mutate the outgoing request.\n' +
    '//\n' +
    "// await oh.variables.set('timestamp', String(Date.now()));\n" +
    // biome-ignore lint/suspicious/noTemplateCurlyInString: the ${...} inside the example is literal user code, not a JS placeholder
    "// oh.setHeader('Authorization', `Bearer ${await oh.vault.get('api_token')}`);\n",
  'post-response':
    '// Use JavaScript to write tests, visualize response, and more.\n' +
    '//\n' +
    "// oh.test('status is 200', () => {\n" +
    '//   oh.expect(oh.response).toHaveStatus(200);\n' +
    '// });\n',
};

interface ScriptsTabProps {
  preRequestScript: string;
  postResponseScript: string;
  onPreRequestChange: (value: string) => void;
  onPostResponseChange: (value: string) => void;
}

const ScriptsTab: React.FC<ScriptsTabProps> = ({
  preRequestScript,
  postResponseScript,
  onPreRequestChange,
  onPostResponseChange,
}) => {
  const { token } = theme.useToken();
  const [active, setActive] = useState<ScriptKind>('pre-request');

  const value = active === 'pre-request' ? preRequestScript : postResponseScript;
  const onChange = (v: string) => {
    // Treat the placeholder-only buffer as empty so the dirty
    // fingerprint doesn't flip on mount.
    const normalized = v === SCRIPT_PLACEHOLDER[active] ? '' : v;
    if (active === 'pre-request') onPreRequestChange(normalized);
    else onPostResponseChange(normalized);
  };

  const Rail: React.FC<{ kind: ScriptKind; label: string }> = ({ kind, label }) => {
    const selected = active === kind;
    const hasScript = kind === 'pre-request' ? preRequestScript.trim() : postResponseScript.trim();
    return (
      <button
        type="button"
        onClick={() => setActive(kind)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '8px 12px',
          background: selected ? token.colorFillTertiary : 'transparent',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
          color: token.colorText,
          fontSize: 13,
          textAlign: 'left',
        }}
      >
        <span>{label}</span>
        {hasScript && (
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: token.colorPrimary,
            }}
          />
        )}
      </button>
    );
  };

  return (
    <div style={{ display: 'flex', gap: 16, height: '100%', minHeight: 340 }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          width: 180,
          paddingRight: 12,
          borderRight: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Rail kind="pre-request" label="Pre-request" />
        <Rail kind="post-response" label="Post-response" />
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
        <Text type="secondary" style={{ fontSize: 11 }}>
          {active === 'pre-request'
            ? 'Runs in a sandboxed iframe before the request is sent. Use oh.setHeader / oh.setUrl / oh.setBody to mutate the outgoing request.'
            : 'Runs in a sandboxed iframe after the response arrives. Register assertions with oh.test(name, fn).'}
        </Text>
        <div style={{ flex: 1, minHeight: 280 }}>
          <ScriptEditor kind={active} value={value || SCRIPT_PLACEHOLDER[active]} onChange={onChange} />
        </div>
      </div>
    </div>
  );
};

export default ScriptsTab;
