/**
 * ScriptLogList — renders the console output captured by a pre-request
 * or post-response script, color-coded by log level.
 */

import type { ScriptConsoleEntry } from '@openheaders/core/scripts';
import { Typography, theme } from 'antd';
import type React from 'react';

const { Text } = Typography;

const ScriptLogList: React.FC<{ entries: ScriptConsoleEntry[] }> = ({ entries }) => {
  const { token } = theme.useToken();
  const color = (level: string): string =>
    level === 'error'
      ? token.colorError
      : level === 'warn'
        ? token.colorWarning
        : level === 'debug'
          ? token.colorTextTertiary
          : token.colorTextSecondary;
  return (
    <div style={{ marginBottom: 8 }}>
      {entries.map((e, idx) => (
        <div
          key={`${e.timeMs}:${idx}`}
          style={{
            display: 'flex',
            gap: 8,
            fontFamily: "'SF Mono', monospace",
            fontSize: 11,
            padding: '2px 0',
            alignItems: 'flex-start',
          }}
        >
          <Text style={{ color: token.colorTextTertiary, minWidth: 48 }}>{e.timeMs}ms</Text>
          <Text style={{ color: color(e.level), minWidth: 44, textTransform: 'uppercase' }}>{e.level}</Text>
          <Text style={{ color: token.colorText, wordBreak: 'break-all' }}>{e.args.join(' ')}</Text>
        </div>
      ))}
    </div>
  );
};

export default ScriptLogList;
