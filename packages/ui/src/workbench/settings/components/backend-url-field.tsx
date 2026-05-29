/**
 * Backend-URL field with a uniform connect affordance (WS-A3).
 *
 * Custom editor for `backend.url`. The persisted value stays the single
 * canonical `ws://host:port` string every dialer reads (websocket,
 * probe, backend-target, pair-with-code), but the user edits it as the
 * three parts they actually think in: scheme, Address, Port. This is the
 * `lan-peers-toggle` idiom — persist the literal, present the friendlier
 * affordance — so `isModified` / Reset keep deriving from the canonical
 * string with no extra schema keys.
 *
 * Scheme stays editable because it carries the reach: `ws://` for local
 * / LAN hosts, `wss://` for a remote self-hosted back-end. Address and
 * Port commit on blur / Enter (draft-commit, like StringField); scheme
 * is a discrete choice so it commits immediately.
 */

import { Input, Select, Space } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useSetting } from '../hooks';
import type { SettingDef } from '../types';
import FieldRow from '../fields/FieldRow';

type Scheme = 'ws' | 'wss';
interface UrlParts {
  scheme: Scheme;
  address: string;
  port: string;
}

function parseUrl(raw: string): UrlParts {
  try {
    const u = new URL(raw);
    return {
      scheme: u.protocol === 'wss:' ? 'wss' : 'ws',
      // URL keeps IPv6 literals bracketed in `hostname`; strip them so
      // the Address field shows the bare address and buildUrl re-wraps.
      address: u.hostname.replace(/^\[|\]$/g, ''),
      port: u.port,
    };
  } catch {
    return { scheme: 'ws', address: '', port: '' };
  }
}

function buildUrl({ scheme, address, port }: UrlParts): string {
  const host = address.includes(':') ? `[${address}]` : address;
  return port ? `${scheme}://${host}:${port}` : `${scheme}://${host}`;
}

const BackendUrlField: React.FC<{ def: SettingDef }> = ({ def }) => {
  const [url, setUrl] = useSetting('backend.url');
  const [parts, setParts] = useState<UrlParts>(() => parseUrl(url));

  useEffect(() => {
    setParts(parseUrl(url));
  }, [url]);

  const commit = useCallback(
    (next: UrlParts) => {
      const built = buildUrl(next);
      if (built !== url) setUrl(built);
    },
    [url, setUrl],
  );

  return (
    <FieldRow settingKey={def.key} label={def.label} description={def.description}>
      <Space.Compact style={{ width: '100%' }}>
        <Select
          value={parts.scheme}
          style={{ flex: '0 0 92px' }}
          aria-label="Scheme"
          onChange={(scheme: Scheme) => {
            const next = { ...parts, scheme };
            setParts(next);
            commit(next);
          }}
          options={[
            { value: 'ws', label: 'ws://' },
            { value: 'wss', label: 'wss://' },
          ]}
        />
        <Input
          style={{ flex: 1 }}
          value={parts.address}
          placeholder="127.0.0.1"
          aria-label="Address"
          onChange={(e) => setParts({ ...parts, address: e.target.value.trim() })}
          onBlur={() => commit(parts)}
          onPressEnter={() => commit(parts)}
        />
        <Input
          style={{ flex: '0 0 110px' }}
          addonBefore=":"
          value={parts.port}
          placeholder="8137"
          inputMode="numeric"
          aria-label="Port"
          onChange={(e) => setParts({ ...parts, port: e.target.value.replace(/\D/g, '') })}
          onBlur={() => commit(parts)}
          onPressEnter={() => commit(parts)}
        />
      </Space.Compact>
    </FieldRow>
  );
};

export default BackendUrlField;
