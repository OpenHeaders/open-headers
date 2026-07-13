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
 *
 * Two entry modes, because the back-end hands out credentials in two
 * shapes: a 6-digit pairing code (exchanged for a token over
 * `pairWithCode`) and the raw token itself (a rotation shows the new
 * secret once, to be pasted here directly — no exchange).
 */

import { App as AntApp, Button, type ButtonProps, Input, Popover, Space, Typography } from 'antd';
import type React from 'react';
import { useCallback, useState } from 'react';
import { getCapability, type PairWithCodeResult } from '@openheaders/core/capabilities';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';

export function humanizePairFailure(
  result: Extract<PairWithCodeResult, { ok: false }>,
  url: string,
  t: Translate,
): string {
  switch (result.reason) {
    case 'unknown':
      return t('workbench.settings.backendPane.pair.fail.unknown');
    case 'expired':
      return t('workbench.settings.backendPane.pair.fail.expired');
    case 'consumed':
      return t('workbench.settings.backendPane.pair.fail.consumed');
    case 'unreachable':
      return t('workbench.settings.backendPane.pair.fail.unreachable', { url });
    default:
      return result.message ?? t('workbench.settings.backendPane.pair.fail.generic');
  }
}

export const PairPopover: React.FC<{
  url: string;
  onPaired: (token: string) => void;
  buttonLabel?: string;
  buttonType?: ButtonProps['type'];
}> = ({ url, onPaired, buttonLabel, buttonType }) => {
  const { message } = AntApp.useApp();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'code' | 'token'>('code');
  const [code, setCode] = useState('');
  const [token, setToken] = useState('');
  const [deviceLabel, setDeviceLabel] = useState('');
  const [pairing, setPairing] = useState(false);

  const reset = useCallback(() => {
    setMode('code');
    setCode('');
    setToken('');
    setDeviceLabel('');
    setPairing(false);
  }, []);

  const submitToken = useCallback(() => {
    const trimmed = token.trim();
    if (!trimmed) {
      message.error(t('workbench.settings.backendPane.pair.pasteTokenRequired'));
      return;
    }
    onPaired(trimmed);
    message.success(t('workbench.settings.backendPane.pair.tokenSaved'));
    setOpen(false);
    reset();
  }, [token, onPaired, message, reset, t]);

  const submit = useCallback(async () => {
    const exchange = getCapability('pairWithCode');
    if (!exchange) return;
    const trimmed = code.trim();
    if (!trimmed) {
      message.error(t('workbench.settings.backendPane.pair.codeRequired'));
      return;
    }
    setPairing(true);
    const result = await exchange({ url, code: trimmed, deviceLabel: deviceLabel.trim() || undefined });
    setPairing(false);
    if (result.ok) {
      onPaired(result.token);
      message.success(t('workbench.settings.backendPane.pair.pairedSaved'));
      setOpen(false);
      reset();
      return;
    }
    message.error(humanizePairFailure(result, url, t));
  }, [code, deviceLabel, url, onPaired, message, reset, t]);

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
      title={
        mode === 'code'
          ? t('workbench.settings.backendPane.pair.pairWithCode')
          : t('workbench.settings.backendPane.pair.pasteTokenTitle')
      }
      content={
        <div style={{ width: 280 }}>
          {mode === 'code' ? (
            <>
              <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 8 }}>
                {t('workbench.settings.backendPane.pair.codeBlurb')}
              </Typography.Paragraph>
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Input
                  autoFocus
                  value={code}
                  placeholder={t('workbench.settings.backendPane.pair.codePlaceholder')}
                  inputMode="numeric"
                  maxLength={12}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  onPressEnter={() => void submit()}
                />
                <Input
                  value={deviceLabel}
                  placeholder={t('workbench.settings.backendPane.pair.deviceNamePlaceholder')}
                  maxLength={64}
                  onChange={(e) => setDeviceLabel(e.target.value)}
                  onPressEnter={() => void submit()}
                />
                <Button type="primary" block loading={pairing} onClick={() => void submit()}>
                  {t('workbench.settings.backendPane.pair.pairAction')}
                </Button>
              </Space>
            </>
          ) : (
            <>
              <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 8 }}>
                {t('workbench.settings.backendPane.pair.tokenBlurb')}
              </Typography.Paragraph>
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Input.Password
                  autoFocus
                  value={token}
                  placeholder="oh_…"
                  onChange={(e) => setToken(e.target.value)}
                  onPressEnter={submitToken}
                />
                <Button type="primary" block onClick={submitToken}>
                  {t('workbench.settings.backendPane.pair.saveToken')}
                </Button>
              </Space>
            </>
          )}
          <Button
            type="link"
            size="small"
            style={{ padding: 0, marginTop: 8, fontSize: 12 }}
            onClick={() => setMode(mode === 'code' ? 'token' : 'code')}
          >
            {mode === 'code'
              ? t('workbench.settings.backendPane.pair.switchToToken')
              : t('workbench.settings.backendPane.pair.switchToCode')}
          </Button>
        </div>
      }
    >
      <Button type={buttonType} disabled={!url}>
        {buttonLabel ?? t('workbench.settings.backendPane.pair.pairWithCode')}
      </Button>
    </Popover>
  );
};
