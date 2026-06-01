/**
 * Pair-with-a-code popover (WS-A2 / WS-A6).
 *
 * The shared affordance for exchanging the 6-digit code the back-end
 * displays for a long-lived auth token, through the host-neutral
 * `pairWithCode` capability. Two consumers:
 *
 *   - the `backend.authToken` field editor, for first-time pairing;
 *   - the BackendPane re-pair banner, surfaced when a previously-good
 *     token is rejected (`auth-required`) and the device must pair again.
 *
 * Both hand us a `url` (the configured back-end address) and an
 * `onPaired` callback that writes the resulting token into the setting.
 * The button label / type are caller-tunable so the banner can render a
 * primary "Pair with a code" call-to-action while the field keeps the
 * neutral default.
 */

import { App as AntApp, Button, type ButtonProps, Input, Popover, Space, Typography } from 'antd';
import type React from 'react';
import { useCallback, useState } from 'react';
import { getCapability, type PairWithCodeResult } from '@openheaders/core/capabilities';

export function humanizePairFailure(result: Extract<PairWithCodeResult, { ok: false }>, url: string): string {
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

export const PairPopover: React.FC<{
  url: string;
  onPaired: (token: string) => void;
  buttonLabel?: string;
  buttonType?: ButtonProps['type'];
}> = ({ url, onPaired, buttonLabel = 'Pair with a code', buttonType }) => {
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
    message.error(humanizePairFailure(result, url));
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
      <Button type={buttonType} disabled={!url}>
        {buttonLabel}
      </Button>
    </Popover>
  );
};
