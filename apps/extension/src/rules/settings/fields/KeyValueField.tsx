/**
 * KeyValueField — editable list of key/value string pairs.
 *
 * Stored as `Record<string, string>`. Rows are rendered from state,
 * committed to the store on blur + add/remove. Empty keys are
 * discarded on commit.
 */

import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Input, Space } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useUntypedSetting } from '../hooks';
import type { SettingDef } from '../types';
import FieldRow from './FieldRow';

interface KeyValueFieldProps {
  def: SettingDef;
}

interface Row {
  key: string;
  value: string;
}

function toRows(raw: unknown): Row[] {
  if (!raw || typeof raw !== 'object') return [];
  const entries = Object.entries(raw as Record<string, unknown>);
  return entries.map(([k, v]) => ({ key: k, value: typeof v === 'string' ? v : String(v) }));
}

function fromRows(rows: Row[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of rows) {
    if (row.key.length === 0) continue;
    out[row.key] = row.value;
  }
  return out;
}

const KeyValueField: React.FC<KeyValueFieldProps> = ({ def }) => {
  const [storeValue, setStoreValue] = useUntypedSetting(def.key);
  const [rows, setRows] = useState<Row[]>(() => toRows(storeValue));

  useEffect(() => {
    setRows(toRows(storeValue));
  }, [storeValue]);

  const commit = useCallback(
    (next: Row[]) => {
      setRows(next);
      setStoreValue(fromRows(next));
    },
    [setStoreValue],
  );

  return (
    <FieldRow
      settingKey={def.key}
      label={def.label}
      description={def.description}
      experimental={def.experimental}
      requiresConnection={def.requiresConnection}
      block
    >
      <Space direction="vertical" style={{ width: '100%' }} size={6}>
        {rows.map((row, i) => (
          <Space.Compact key={`${i}-${row.key}`} style={{ width: '100%' }}>
            <Input
              placeholder="key"
              value={row.key}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...row, key: e.target.value };
                setRows(next);
              }}
              onBlur={() => commit(rows)}
            />
            <Input
              placeholder="value"
              value={row.value}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...row, value: e.target.value };
                setRows(next);
              }}
              onBlur={() => commit(rows)}
            />
            <Button
              icon={<DeleteOutlined />}
              onClick={() => {
                const next = rows.filter((_, idx) => idx !== i);
                commit(next);
              }}
            />
          </Space.Compact>
        ))}
        <Button
          icon={<PlusOutlined />}
          onClick={() => commit([...rows, { key: '', value: '' }])}
          block
        >
          Add entry
        </Button>
      </Space>
    </FieldRow>
  );
};

export default KeyValueField;
