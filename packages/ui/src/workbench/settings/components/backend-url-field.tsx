/**
 * Backend-URL field with a uniform connect affordance (WS-A3).
 *
 * Editor for one `OH.backends` record's URL, resolved through the
 * row-editor's record context. The persisted value stays the single
 * canonical `ws://host:port` string every dialer reads (websocket,
 * probe, backend-target, pair-with-code), but the user edits it as the
 * three parts they actually think in: scheme, Address, Port. This is
 * the `lan-peers-toggle` idiom — persist the literal, present the
 * friendlier affordance.
 *
 * Scheme stays editable because it carries the reach: `ws://` for local
 * / LAN hosts, `wss://` for a remote self-hosted back-end.
 *
 * Commits on blur/enter are safe here: the row editor only mounts the
 * connection fields while the record is DISABLED, so a half-typed
 * address can never move a live connection — the wire is only earned
 * through the probe-gated enable afterwards.
 */

import { Input, Select, Space } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { type PortValidation, validatePort } from '@openheaders/core/utils';
import FieldRow from '../fields/FieldRow';
import { useBackendRecord } from './backend-record-context';
import PortHint from './port-hint';

const FIELD_LABEL = 'Backend address';
const FIELD_DESCRIPTION = 'Where this client dials the back-end. `ws://` for local / LAN hosts, `wss://` for remote.';

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

/**
 * An empty port is the "no explicit port" state (the dialer falls back to
 * the scheme default), so it's `ok` — only a typed port is range-checked.
 */
function portVerdict(port: string): PortValidation {
  if (port === '') return { level: 'ok' };
  return validatePort(Number(port));
}

const BackendUrlField: React.FC = () => {
  const handle = useBackendRecord();
  const url = handle?.record.url ?? '';
  const [parts, setParts] = useState<UrlParts>(() => parseUrl(url));

  useEffect(() => {
    setParts(parseUrl(url));
  }, [url]);

  const verdict = portVerdict(parts.port);

  const commit = useCallback(
    (next: UrlParts) => {
      // A rejected port (privileged / out-of-range) blocks the whole URL
      // commit — the dialer reads one canonical string, so a bad port
      // can't be persisted while the address change rides along.
      if (portVerdict(next.port).level === 'reject') return;
      const built = buildUrl(next);
      if (handle && built !== url) void handle.patch({ url: built });
    },
    [url, handle],
  );

  if (!handle) return null;

  return (
    <FieldRow settingKey="backend.url" label={FIELD_LABEL} description={FIELD_DESCRIPTION} block>
      <div style={{ width: '100%' }}>
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
            status={verdict.level === 'reject' ? 'error' : verdict.level === 'warn' ? 'warning' : undefined}
            onChange={(e) => setParts({ ...parts, port: e.target.value.replace(/\D/g, '') })}
            onBlur={() => commit(parts)}
            onPressEnter={() => commit(parts)}
          />
        </Space.Compact>
        <PortHint verdict={verdict} />
      </div>
    </FieldRow>
  );
};

export default BackendUrlField;
