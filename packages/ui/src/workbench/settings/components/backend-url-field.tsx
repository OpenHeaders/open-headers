/**
 * Backend-URL field (WS-A3) — ONE string, the way an administrator
 * hands an address to a person: a host, a `host:port`, or the URL of
 * the server's web tab. `parseBackendAddress` normalizes whatever was
 * typed into the canonical `ws://host:port` / `wss://host` string every
 * dialer reads (websocket, probe, backend-target, pair-with-code,
 * sign-in), and the field reads that canonical form back after a
 * commit so the person sees exactly what will be dialed.
 *
 * Commits on blur/enter are safe here: the row editor only mounts the
 * connection fields while the record is DISABLED, so a half-typed
 * address can never move a live connection — the wire is only earned
 * through the probe-gated enable afterwards. An address that parses to
 * nothing is held with an inline hint and never persisted. No port
 * rule beyond the URL grammar applies here: this is a DIAL address, so
 * 80 and 443 behind a proxy are as legitimate as 8137.
 */

import { Input } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { parseBackendAddress } from '@openheaders/core/identity';
import { useT } from '@openheaders/ui/context/LocaleContext';
import FieldRow from '../fields/FieldRow';
import { useBackendRecord } from './backend-record-context';
import PortHint, { type PortHintVerdict } from './port-hint';

const OK: PortHintVerdict = { level: 'ok' };
const INVALID: PortHintVerdict = {
  level: 'reject',
  messageKey: 'workbench.settings.backendPane.field.url.invalid',
};

/** The record's URL as the field shows it — an address-less record reads empty. */
function displayed(url: string): string {
  return parseBackendAddress(url) === null ? '' : url;
}

const BackendUrlField: React.FC = () => {
  const t = useT();
  const handle = useBackendRecord();
  const url = handle?.record.url ?? '';
  const [text, setText] = useState<string>(() => displayed(url));
  const [verdict, setVerdict] = useState<PortHintVerdict>(OK);

  useEffect(() => {
    setText(displayed(url));
    setVerdict(OK);
  }, [url]);

  const commit = useCallback((): void => {
    const canonical = parseBackendAddress(text);
    if (canonical === null) {
      setVerdict(text.trim() === '' ? OK : INVALID);
      return;
    }
    setVerdict(OK);
    setText(canonical);
    if (handle && canonical !== url) void handle.patch({ url: canonical });
  }, [text, url, handle]);

  if (!handle) return null;

  return (
    <FieldRow
      settingKey="backend.url"
      label={t('workbench.settings.backendPane.field.url.label')}
      description={t('workbench.settings.backendPane.field.url.description')}
      block
    >
      <div style={{ width: '100%' }}>
        <Input
          value={text}
          placeholder="192.168.1.20:8137"
          aria-label={t('workbench.settings.backendPane.field.url.label')}
          status={verdict.level === 'reject' ? 'error' : undefined}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onPressEnter={commit}
        />
        <PortHint verdict={verdict} />
      </div>
    </FieldRow>
  );
};

export default BackendUrlField;
