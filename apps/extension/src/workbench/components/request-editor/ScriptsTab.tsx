/**
 * ScriptsTab — lift the previous Pre-request / Post-response sibling
 * tabs into ONE tab with a left-rail picker + shared Monaco editor.
 *
 * The editor starts empty. A single-line ghost hint ("Use JavaScript
 * to write tests, visualize response, and more.") floats over the
 * blank buffer so new authors aren't left staring at a raw line 1
 * marker, but the hint is NOT actual script content — the draft's
 * script stays empty until the user types, so the dirty fingerprint
 * and the Save path don't have to treat example code as meaningful.
 */

import type { ScriptKind } from '@openheaders/core/scripts';
import { Typography, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import ScriptEditor from '../script-editor/ScriptEditor';

const { Text } = Typography;

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
    if (active === 'pre-request') onPreRequestChange(v);
    else onPostResponseChange(v);
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
          position: 'sticky',
          top: 0,
          alignSelf: 'start',
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
          <ScriptEditor kind={active} value={value} onChange={onChange} />
        </div>
      </div>
    </div>
  );
};

export default ScriptsTab;
