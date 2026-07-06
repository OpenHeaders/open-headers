/**
 * ScriptsTab — Pre-request / Post-response scripts in ONE tab with a
 * left-rail picker + shared Monaco editor. Each rail entry carries an
 * `(i)` popover explaining when that script runs and its `oh.*` API —
 * the editor pane itself stays chrome-free.
 *
 * The editor starts empty. A single-line ghost hint floats over the
 * blank buffer so new authors aren't left staring at a raw line 1
 * marker, but the hint is NOT actual script content — the draft's
 * script stays empty until the user types, so the dirty fingerprint
 * and the Save path don't have to treat example code as meaningful.
 */

import type { ScriptKind } from '@openheaders/core/scripts';
import { theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { type InfoPopoverContent, InfoTrigger } from '@openheaders/ui/shared/info-popover';
import ScriptEditor from '../script-editor/ScriptEditor';

interface ScriptsTabProps {
  preRequestScript: string;
  postResponseScript: string;
  onPreRequestChange: (value: string) => void;
  onPostResponseChange: (value: string) => void;
}

const SCRIPT_INFO: Record<ScriptKind, InfoPopoverContent> = {
  'pre-request': {
    title: 'Pre-request script',
    summary: 'Runs in a sandboxed iframe before the request is sent. Mutate the outgoing request with the oh API:',
    sections: [
      {
        heading: 'API',
        items: [
          { label: 'oh.setHeader(name, value)', desc: 'add or replace a header' },
          { label: 'oh.setUrl(url)', desc: 'rewrite the target URL' },
          { label: 'oh.setBody(body)', desc: 'replace the request body' },
        ],
      },
    ],
  },
  'post-response': {
    title: 'Post-response script',
    summary: 'Runs in a sandboxed iframe after the response arrives. Assertion results land in the Response panel:',
    sections: [
      {
        heading: 'API',
        items: [{ label: 'oh.test(name, fn)', desc: 'register an assertion' }],
      },
    ],
  },
};

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          type="button"
          onClick={() => setActive(kind)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flex: 1,
            minWidth: 0,
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
        <InfoTrigger content={SCRIPT_INFO[kind]} />
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', gap: 16, height: '100%', minHeight: 340 }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          width: 190,
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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ flex: 1, minHeight: 300 }}>
          <ScriptEditor kind={active} value={value} onChange={onChange} />
        </div>
      </div>
    </div>
  );
};

export default ScriptsTab;
