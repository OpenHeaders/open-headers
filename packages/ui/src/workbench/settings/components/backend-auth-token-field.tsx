/**
 * Daemon auth-token field with in-app pairing (WS-A2).
 *
 * Custom editor for `backend.authToken`. Renders the plain token input
 * (same draft-commit semantics as the generic StringField) plus a "Pair
 * with a code" affordance: the user types the 6-digit code the daemon
 * displayed and we exchange it for a token through the host-neutral
 * `pairWithCode` capability, writing the result straight into the
 * setting — no leaving the app to open the server-rendered confirm page
 * and hand-copy the secret.
 *
 * The pairing button only appears when the running host registered the
 * capability (the extension surfaces do; a host that pairs by another
 * gesture doesn't) and a back-end URL is configured. Everything else
 * degrades to the bare token input.
 */

import { App as AntApp, Button, Input, Popover, Space, Typography } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { getCapability, hasCapability, type PairWithCodeResult } from '@openheaders/core/capabilities';
import { useSetting, useSettingValue } from '../hooks';
import type { SettingDef } from '../types';
import FieldRow from '../fields/FieldRow';

function humanizeFailure(result: Extract<PairWithCodeResult, { ok: false }>, url: string): string {
  switch (result.reason) {
    case 'unknown':
      return 'That code is unknown or has expired. Ask for a fresh code and try again.';
    case 'expired':
      return 'That pairing code has expired. Generate a new one on the back-end.';
    case 'consumed':
      return 'That code was already used. Generate a new one on the back-end.';
    case 'unreachable':
      return `Couldn't reach the back-end at ${url}. Is it running on that address?`;
    default:
      return result.message ?? 'Pairing failed. Try again.';
  }
}

const PairPopover: React.FC<{
  url: string;
  onPaired: (token: string) => void;
}> = ({ url, onPaired }) => {
  const { message } = AntApp.useApp();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [deviceLabel, setDeviceLabel] = useState('');
  const [pairing, setPairing] = useState(false);

  const reset = useCallback(() => {
    setCode('');
    setDeviceLabel('');
    setPairing(false);
  }, []);

  const submit = useCallback(async () => {
    const exchange = getCapability('pairWithCode');
    if (!exchange) return;
    const trimmed = code.trim();
    if (!trimmed) {
      message.error('Enter the pairing code shown on the back-end.');
      return;
    }
    setPairing(true);
    const result = await exchange({ url, code: trimmed, deviceLabel: deviceLabel.trim() || undefined });
    setPairing(false);
    if (result.ok) {
      onPaired(result.token);
      message.success('Paired — auth token saved.');
      setOpen(false);
      reset();
      return;
    }
    message.error(humanizeFailure(result, url));
  }, [code, deviceLabel, url, onPaired, message, reset]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
      trigger="click"
      placement="topLeft"
      destroyTooltipOnHide
      title="Pair with a code"
      content={
        <div style={{ width: 280 }}>
          <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 8 }}>
            Enter the code the back-end displayed. We'll exchange it for an
            auth token and connect this browser.
          </Typography.Paragraph>
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Input
              autoFocus
              value={code}
              placeholder="6-digit code"
              inputMode="numeric"
              maxLength={12}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              onPressEnter={() => void submit()}
            />
            <Input
              value={deviceLabel}
              placeholder="Device name (optional)"
              maxLength={64}
              onChange={(e) => setDeviceLabel(e.target.value)}
              onPressEnter={() => void submit()}
            />
            <Button type="primary" block loading={pairing} onClick={() => void submit()}>
              Pair
            </Button>
          </Space>
        </div>
      }
    >
      <Button disabled={!url}>Pair with a code</Button>
    </Popover>
  );
};

const BackendAuthTokenField: React.FC<{ def: SettingDef }> = ({ def }) => {
  const [token, setToken] = useSetting('backend.authToken');
  const url = useSettingValue('backend.url');
  const [draft, setDraft] = useState(token);

  useEffect(() => {
    setDraft(token);
  }, [token]);

  const commit = useCallback(() => {
    if (draft !== token) setToken(draft);
  }, [draft, token, setToken]);

  const onPaired = useCallback(
    (next: string) => {
      setDraft(next);
      setToken(next);
    },
    [setToken],
  );

  const canPair = hasCapability('pairWithCode');

  return (
    <FieldRow settingKey={def.key} label={def.label} description={def.description} block>
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <Input.Password
          value={draft}
          placeholder="Paste a token, or pair with a code"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onPressEnter={commit}
        />
        {canPair && <PairPopover url={url} onPaired={onPaired} />}
      </Space>
    </FieldRow>
  );
};

export default BackendAuthTokenField;
