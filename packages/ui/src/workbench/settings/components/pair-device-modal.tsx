/**
 * Daemon-side pairing modal (U3.3, `DATA_PLANE_TOPOLOGIES.md` §11.4
 * hybrid pattern).
 *
 * The admin clicks "Pair a device" on the daemon's Paired-devices
 * surface. This modal allocates a fresh 6-digit code via the
 * `oh.daemon.pairing.start` RPC, displays it with a 5-minute countdown,
 * and polls `oh.daemon.pairing.list` once per second to flip into the
 * "Paired" state when the peer confirms.
 *
 * Primary path (WS-A2): the peer types this code into their own
 * Settings → Backend → "Pair with a code", which exchanges it for a
 * token in-app — no page to open, nothing to hand-copy. The daemon-served
 * link + QR remain a fallback for a device without that affordance: it
 * opens an HTML confirm page that surfaces a token to paste by hand.
 *
 * Either way the secret NEVER reaches this modal — the daemon-side
 * ledger records only the hash (same path as the manual "Generate
 * token" flow); the admin sees the new token row appear in
 * `DaemonTokensSection` once polling reports `confirmed`/`consumed`.
 */

import { App as AntApp, Alert, Button, Divider, Input, Modal, QRCode, Space, Tag, Typography, theme } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import { hostBridge } from '@openheaders/core/bridge';
import { useT } from '@openheaders/ui/context/LocaleContext';

const POLL_INTERVAL_MS = 1_000;

interface PairingUrl {
  readonly host: string;
  readonly url: string;
  readonly iface?: string;
}

interface ActivePairing {
  readonly code: string;
  readonly expiresAt: number;
  readonly port: number;
  readonly pairingUrls: readonly PairingUrl[];
}

type PairStatus = 'pending' | 'confirmed' | 'expired' | 'consumed';

interface Props {
  readonly open: boolean;
  readonly onClose: () => void;
}

function pickPrimaryUrl(urls: readonly PairingUrl[]): PairingUrl | undefined {
  // Prefer the first non-loopback address — that's what a remote peer
  // would actually use. Fall back to loopback so the QR still scans
  // when only a same-machine pairing is possible.
  return urls.find((u) => u.host !== '127.0.0.1') ?? urls[0];
}

function formatRemaining(expiresAt: number, now: number): string {
  const ms = Math.max(0, expiresAt - now);
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const PairDeviceModal: React.FC<Props> = ({ open, onClose }) => {
  const { token } = theme.useToken();
  const { message } = AntApp.useApp();
  const t = useT();
  const [active, setActive] = useState<ActivePairing | null>(null);
  const [status, setStatus] = useState<PairStatus | 'starting' | 'error'>('starting');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [tick, setTick] = useState(Date.now());
  // Avoid double-starting from a fast re-open while the previous start
  // RPC is in flight (React strict-mode double-effect in dev).
  const startingRef = useRef(false);

  const close = useCallback(() => {
    if (active && (status === 'pending' || status === 'starting')) {
      // Best-effort cancel — the daemon will GC on expiry anyway, but
      // freeing the slot now means the next pairing can start without
      // bumping into the per-process cap.
      hostBridge.call('oh.daemon.pairing.cancel', { code: active.code }).catch(() => undefined);
    }
    setActive(null);
    setStatus('starting');
    setErrorMessage('');
    onClose();
  }, [active, status, onClose]);

  // Allocate a fresh code on open.
  useEffect(() => {
    if (!open) return;
    if (startingRef.current) return;
    startingRef.current = true;
    setStatus('starting');
    setErrorMessage('');
    setActive(null);
    void hostBridge
      .call('oh.daemon.pairing.start', {})
      .then((resp) => {
        startingRef.current = false;
        if (!resp.ok) {
          setStatus('error');
          setErrorMessage(resp.error);
          return;
        }
        setActive({
          code: resp.code,
          expiresAt: resp.expiresAt,
          port: resp.port,
          pairingUrls: resp.pairingUrls,
        });
        setStatus('pending');
      })
      .catch((err: Error) => {
        startingRef.current = false;
        setStatus('error');
        setErrorMessage(err.message);
      });
  }, [open]);

  // Poll while pending so we can flip to "Paired" the moment the
  // peer confirms in their browser.
  useEffect(() => {
    if (!open || !active) return;
    if (status !== 'pending') return;
    const interval = window.setInterval(() => {
      const now = Date.now();
      setTick(now);
      void hostBridge
        .call('oh.daemon.pairing.list')
        .then((resp) => {
          const mine = resp.pairs.find((p) => p.code === active.code);
          if (!mine) {
            // GC'd or cancelled elsewhere — treat as expired so the
            // user sees a clear terminal state.
            setStatus('expired');
            return;
          }
          if (mine.status !== status) setStatus(mine.status);
        })
        .catch(() => undefined);
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [open, active, status]);

  const primary = active ? pickPrimaryUrl(active.pairingUrls) : undefined;

  async function copyToClipboard(value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      message.success(t('shared.toast.copiedToClipboard'));
    } catch {
      message.error(t('shared.toast.copyFailed'));
    }
  }

  return (
    <Modal
      open={open}
      title={t('workbench.settings.daemonTokens.pairDevice')}
      onCancel={close}
      // A stray click on the backdrop (or an Esc) mid-pairing would
      // discard the live code and force a fresh allocation. Only the X
      // and the footer button dismiss it.
      maskClosable={false}
      keyboard={false}
      footer={[
        <Button key="done" type="primary" onClick={close}>
          {status === 'confirmed' || status === 'consumed'
            ? t('workbench.settings.daemonTokens.pairModal.done')
            : t('shared.action.close')}
        </Button>,
      ]}
      width={520}
      destroyOnClose
    >
      {status === 'starting' && (
        <Typography.Text>{t('workbench.settings.daemonTokens.pairModal.allocating')}</Typography.Text>
      )}

      {status === 'error' && (
        <Alert
          type="error"
          showIcon
          message={t('workbench.settings.daemonTokens.pairModal.startFailed')}
          description={errorMessage}
        />
      )}

      {status === 'expired' && (
        <Alert
          type="warning"
          showIcon
          message={t('workbench.settings.daemonTokens.pairModal.expiredTitle')}
          description={t('workbench.settings.daemonTokens.pairModal.expiredBody')}
        />
      )}

      {(status === 'confirmed' || status === 'consumed') && (
        <Alert
          type="success"
          showIcon
          message={t('workbench.settings.daemonTokens.pairModal.pairedTitle')}
          description={t('workbench.settings.daemonTokens.pairModal.pairedBody')}
        />
      )}

      {status === 'pending' && active && primary && (
        <div>
          <Typography.Paragraph style={{ marginBottom: 12 }}>
            {t('workbench.settings.daemonTokens.pairModal.intro.part1')}{' '}
            <strong>{t('workbench.settings.daemonTokens.pairModal.intro.settingsPath')}</strong>
            {t('workbench.settings.daemonTokens.pairModal.intro.part2')}{' '}
            <strong>{t('workbench.settings.daemonTokens.pairModal.intro.address')}</strong>{' '}
            {t('workbench.settings.daemonTokens.pairModal.intro.part3')}{' '}
            <strong>{t('workbench.settings.backendPane.pair.pairWithCode')}</strong>{' '}
            {t('workbench.settings.daemonTokens.pairModal.intro.part4')}
          </Typography.Paragraph>

          <div
            style={{
              textAlign: 'center',
              padding: '14px 16px',
              borderRadius: 10,
              border: `1px solid ${token.colorBorderSecondary}`,
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: token.colorTextTertiary }}>
              {t('workbench.settings.daemonTokens.pairModal.codeLabel')}
            </div>
            <div
              style={{
                fontSize: 40,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontWeight: 600,
                letterSpacing: 6,
                marginTop: 2,
              }}
            >
              {active.code}
            </div>
            <div style={{ fontSize: 12, color: token.colorTextTertiary, marginTop: 4 }}>
              {t('workbench.settings.daemonTokens.pairModal.expiresIn', {
                remaining: formatRemaining(active.expiresAt, tick),
              })}
            </div>
          </div>

          <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 4 }}>
            {t('workbench.settings.daemonTokens.pairModal.addressListLabel')}
          </div>
          <Space direction="vertical" size={6} style={{ width: '100%' }}>
            {active.pairingUrls.map((u) => {
              const wsUrl = `ws://${u.host}:${active.port}`;
              return (
                <div key={u.host} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Input value={wsUrl} readOnly size="small" style={{ fontFamily: 'monospace', fontSize: 12 }} />
                  <Tag style={{ marginInlineEnd: 0 }}>{u.iface ?? 'loopback'}</Tag>
                  <Button size="small" onClick={() => void copyToClipboard(wsUrl)}>
                    {t('shared.action.copy')}
                  </Button>
                </div>
              );
            })}
          </Space>

          <Divider style={{ margin: '14px 0 12px' }} />

          <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 8 }}>
            {t('workbench.settings.daemonTokens.pairModal.fallback.prefix')}{' '}
            <strong>{t('workbench.settings.backendPane.pair.pairWithCode')}</strong>{' '}
            {t('workbench.settings.daemonTokens.pairModal.fallback.suffix')}
          </Typography.Paragraph>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <Space direction="vertical" size={6} style={{ flex: 1, minWidth: 0 }}>
              {active.pairingUrls.map((u) => (
                <div key={u.host} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Input value={u.url} readOnly size="small" style={{ fontFamily: 'monospace', fontSize: 12 }} />
                  <Tag style={{ marginInlineEnd: 0 }}>{u.iface ?? 'loopback'}</Tag>
                  <Button size="small" onClick={() => void copyToClipboard(u.url)}>
                    {t('shared.action.copy')}
                  </Button>
                </div>
              ))}
            </Space>
            <QRCode value={primary.url} size={96} bordered={false} />
          </div>
        </div>
      )}
    </Modal>
  );
};

export default PairDeviceModal;
