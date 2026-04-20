/**
 * ParamsTab — Query Params editor. A three-column key/value/description
 * table; appended to the request URL as `?k=v` pairs by the executor.
 * "Bulk Edit" swaps the table for a plain text editor (one `key=value`
 * pair per line, `#` starts a comment, blank lines ignored).
 */

import { Button, Input, Typography, theme } from 'antd';
import type React from 'react';
import { useMemo, useState } from 'react';
import KeyValueTable, { type KeyValueRow, makeKvRow } from './KeyValueTable';

const { Text } = Typography;

interface ParamsTabProps {
  rows: KeyValueRow[];
  onChange: (rows: KeyValueRow[]) => void;
}

function rowsToText(rows: KeyValueRow[]): string {
  return rows
    .filter((r) => r.key.trim() || r.value.trim() || r.description?.trim())
    .map((r) => {
      const prefix = r.enabled ? '' : '//';
      const note = r.description ? ` # ${r.description}` : '';
      return `${prefix}${r.key}:${r.value}${note}`;
    })
    .join('\n');
}

function textToRows(text: string): KeyValueRow[] {
  const out: KeyValueRow[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimStart();
    if (!line) continue;
    const enabled = !line.startsWith('//');
    const payload = enabled ? line : line.replace(/^\/\/\s*/, '');
    const hashIdx = payload.indexOf(' # ');
    const noteless = hashIdx >= 0 ? payload.slice(0, hashIdx) : payload;
    const description = hashIdx >= 0 ? payload.slice(hashIdx + 3).trim() : '';
    const [key, ...rest] = noteless.split(':');
    out.push(makeKvRow({ key: key?.trim() ?? '', value: rest.join(':').trim(), description, enabled }));
  }
  return out;
}

const ParamsTab: React.FC<ParamsTabProps> = ({ rows, onChange }) => {
  const { token } = theme.useToken();
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');

  const bulkTextValue = useMemo(() => {
    return bulkMode ? bulkText : rowsToText(rows);
  }, [bulkMode, bulkText, rows]);

  const enterBulk = () => {
    setBulkText(rowsToText(rows));
    setBulkMode(true);
  };
  const exitBulk = () => {
    onChange(textToRows(bulkText));
    setBulkMode(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text strong style={{ fontSize: 13 }}>
          Query Params
        </Text>
        <Button size="small" type="text" onClick={bulkMode ? exitBulk : enterBulk}>
          {bulkMode ? 'Key-Value Edit' : 'Bulk Edit'}
        </Button>
      </div>
      {bulkMode ? (
        <Input.TextArea
          value={bulkTextValue}
          onChange={(e) => setBulkText(e.target.value)}
          placeholder={'param1:value1\nparam2:value2 # description\n//disabled:value'}
          autoSize={{ minRows: 6, maxRows: 18 }}
          style={{
            fontFamily: "'SF Mono', 'Fira Code', monospace",
            fontSize: 12,
            background: token.colorBgContainer,
          }}
        />
      ) : (
        <KeyValueTable rows={rows} onChange={onChange} keyPlaceholder="Key" valuePlaceholder="Value" />
      )}
    </div>
  );
};

export default ParamsTab;
