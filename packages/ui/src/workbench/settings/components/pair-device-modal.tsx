/**
 * Daemon-side pairing modal (U3.3, `DATA_PLANE_TOPOLOGIES.md` §11.4
 * hybrid pattern).
 *
 * The admin clicks "Pair a device" on the daemon's LAN-peers settings.
 * This modal allocates a fresh 6-digit code via the
 * `oh.daemon.pairing.start` RPC, displays it alongside every reachable
 * URL + a QR rendering, and polls `oh.daemon.pairing.list` once per
 * second to flip into the "Paired" state when the peer confirms in
 * their browser.
 *
 * The secret itself NEVER reaches this modal — it's emitted in the
 * peer's confirm-page HTML response and the peer pastes it into their
 * own Settings → Backend → Daemon auth token. The daemon-side ledger
 * records only the hash (same path as the manual "Generate token"
 * flow); the admin sees the new token row appear in `DaemonTokensSection`
 * once polling reports `confirmed`/`consumed`.
 */

import { App as AntApp, Alert, Button, Input, Modal, QRCode, Space, Tag, Typography, theme } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import { hostBridge } from '@openheaders/core/bridge';

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
      message.success('Copied to clipboard');
    } catch {
      message.error('Clipboard access denied — copy the value manually');
    }
  }

  return (
    <Modal
      open={open}
      title="Pair a device"
      onCancel={close}
      footer={[
        <Button key="done" type="primary" onClick={close}>
          {status === 'confirmed' || status === 'consumed' ? 'Done' : 'Close'}
        </Button>,
      ]}
      width={520}
      destroyOnClose
    >
      {status === 'starting' && <Typography.Text>Allocating code…</Typography.Text>}

      {status === 'error' && (
        <Alert
          type="error"
          showIcon
          message="Could not start pairing"
          description={errorMessage}
        />
      )}

      {status === 'expired' && (
        <Alert
          type="warning"
          showIcon
          message="Pairing expired"
          description="The 5-minute window elapsed without a confirmation. Close this dialog and click Pair a device again to start over."
        />
      )}

      {(status === 'confirmed' || status === 'consumed') && (
        <Alert
          type="success"
          showIcon
          message="Paired"
          description="The peer confirmed in their browser. A fresh access token has been added to the list below; the secret was shown to the peer once. If they lost it, revoke the new entry and pair again."
        />
      )}

      {status === 'pending' && active && primary && (
        <div>
          <Typography.Paragraph style={{ marginBottom: 8 }}>
            Read the code aloud — or share the URL / QR — with the peer.
            They open the URL in any browser, click Confirm, and copy
            the token the daemon hands them.
          </Typography.Paragraph>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
              borderRadius: 10,
              border: `1px solid ${token.colorBorderSecondary}`,
              marginBottom: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: token.colorTextTertiary }}>
                Pairing code
              </div>
              <div
                style={{
                  fontSize: 36,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontWeight: 600,
                  letterSpacing: 4,
                  marginTop: 2,
                }}
              >
                {active.code}
              </div>
              <div style={{ fontSize: 12, color: token.colorTextTertiary, marginTop: 4 }}>
                expires in {formatRemaining(active.expiresAt, tick)}
              </div>
            </div>
            <QRCode value={primary.url} size={128} bordered={false} />
          </div>

          <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 4 }}>
            Pairing URLs
          </div>
          <Space direction="vertical" size={6} style={{ width: '100%' }}>
            {active.pairingUrls.map((u) => (
              <div key={u.host} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Input value={u.url} readOnly size="small" style={{ fontFamily: 'monospace', fontSize: 12 }} />
                {u.iface ? (
                  <Tag style={{ marginInlineEnd: 0 }}>{u.iface}</Tag>
                ) : (
                  <Tag style={{ marginInlineEnd: 0 }}>loopback</Tag>
                )}
                <Button size="small" onClick={() => void copyToClipboard(u.url)}>Copy</Button>
              </div>
            ))}
          </Space>
        </div>
      )}
    </Modal>
  );
};

export default PairDeviceModal;
