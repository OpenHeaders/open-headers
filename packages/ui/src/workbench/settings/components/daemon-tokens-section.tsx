/**
 * Daemon "Known devices" admin surface (U3.4,
 * `UNIFIED_ORACLE_MODEL.md` §4.2 step 4 + `DATA_PLANE_TOPOLOGIES.md` §11.4).
 *
 * Visible whenever the desktop is the active back-end (it owns the
 * daemon). Pairing is the universal connection floor — every peer,
 * loopback or LAN, presents a paired token (WS-A1) — so device
 * management can't be gated on a non-loopback bind anymore. Each access
 * token is one device; the list highlights tokens whose peer is
 * connected right now and offers a per-device rotate (mint a
 * replacement, revoke the old one).
 *
 * Every read and mutation rides `oh.daemon.tokens.*` RPCs, so the same
 * component serves the desktop settings pane (IPC) and the daemon-admin
 * console on a served web tab (the wire) — the ledger is only local on
 * one of those hosts. Reads poll `tokens.list` on the same cadence as
 * the connected set, which also keeps out-of-band writes (a pairing
 * confirm, another admin surface) visible without a storage
 * subscription. Mutations run in the daemon's main realm, sharing one
 * mutex with HELLO validation (a surface-side write would race main's
 * `lastUsedAt` write-back and could silently undo a revoke). Revoke
 * also evicts the peer's live socket, so a kill takes effect
 * immediately rather than on the peer's next HELLO.
 *
 * Tokens can bind to a directory user at mint time (`userId`) — the
 * bind select appears once the directory has active users, so the solo
 * tier sees no change. Rotation carries the binding over.
 *
 * Minted secrets are shown exactly once. The "Copy this token" dialog
 * is deliberately styled so the admin can't dismiss it accidentally;
 * once closed, only the hash remains on disk.
 */

import { App as AntApp, Button, Form, Input, List, Modal, Popconfirm, Select, Tag, Typography, theme } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import type React from 'react';
import { hostBridge } from '@openheaders/core/bridge';
import PairDeviceModal from './pair-device-modal';

/** How often the ledger + connected-peer set are re-polled while this pane is open. */
const POLL_INTERVAL_MS = 3_000;

/** One `tokens.list` row — the ledger projection, hash excluded. */
interface TokenRow {
  id: string;
  label?: string;
  userId?: string;
  expiresAt?: number;
  createdAt: number;
  lastUsedAt: number | null;
  revokedAt: number | null;
}

/** Active directory users offered by the bind-to-user select. */
interface BindableUser {
  userId: string;
  displayName: string;
}

interface MintModalState {
  open: boolean;
  /** The raw secret returned at mint time. Cleared when the modal closes. */
  secret: string;
  tokenId: string;
  /** Distinguishes a fresh mint from a rotation in the dialog copy. */
  rotated: boolean;
}

function formatTimestamp(ms: number | null | undefined): string {
  if (!ms) return '—';
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return '—';
  }
}

function shortenId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

const DaemonTokensSection: React.FC = () => {
  const { token: themeToken } = theme.useToken();
  const { message } = AntApp.useApp();
  const [tokens, setTokens] = useState<readonly TokenRow[]>([]);
  const [connectedIds, setConnectedIds] = useState<ReadonlySet<string>>(new Set());
  const [bindableUsers, setBindableUsers] = useState<readonly BindableUser[]>([]);
  const [mintForm] = Form.useForm<{ label: string; userId?: string }>();
  const [minting, setMinting] = useState(false);
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [mintResult, setMintResult] = useState<MintModalState>({
    open: false,
    secret: '',
    tokenId: '',
    rotated: false,
  });
  const [pairOpen, setPairOpen] = useState(false);

  const refresh = useCallback(async () => {
    const resp = await hostBridge.call('oh.daemon.tokens.list');
    setTokens(resp.tokens);
  }, []);

  const loadBindableUsers = useCallback(async () => {
    try {
      const resp = await hostBridge.call('oh.daemon.users.list');
      setBindableUsers(
        resp.users.filter((u) => u.deactivatedAt === null).map((u) => ({ userId: u.userId, displayName: u.displayName })),
      );
    } catch {
      setBindableUsers([]);
    }
  }, []);

  useEffect(() => {
    void loadBindableUsers();
  }, [loadBindableUsers]);

  // Poll the ledger and the live connected-peer set together. The
  // daemon doesn't broadcast connect/disconnect or ledger events;
  // polling keeps the RPC surface tiny, works identically over IPC and
  // the wire, and a 3s lag on the "Connected" badge or on an
  // out-of-band row (a pairing confirm, another admin surface) is
  // imperceptible for an admin view.
  useEffect(() => {
    let cancelled = false;
    const poll = (): void => {
      void hostBridge
        .call('oh.daemon.tokens.connected')
        .then((resp) => {
          if (!cancelled) setConnectedIds(new Set(resp.tokenIds));
        })
        .catch(() => undefined);
      void hostBridge
        .call('oh.daemon.tokens.list')
        .then((resp) => {
          if (!cancelled) setTokens(resp.tokens);
        })
        .catch(() => undefined);
    };
    poll();
    const interval = window.setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  async function handleMint(values: { label: string; userId?: string }): Promise<void> {
    setMinting(true);
    try {
      const result = await hostBridge.call('oh.daemon.tokens.mint', {
        label: values.label?.trim() || undefined,
        userId: values.userId || undefined,
      });
      if (!result.ok) throw new Error(result.error);
      mintForm.resetFields();
      setMintResult({ open: true, secret: result.secret, tokenId: result.tokenId, rotated: false });
      await refresh();
    } catch (err) {
      message.error(`Failed to mint token: ${(err as Error).message}`);
    } finally {
      setMinting(false);
    }
  }

  async function handleRevoke(tokenId: string): Promise<void> {
    try {
      const result = await hostBridge.call('oh.daemon.tokens.revoke', { tokenId });
      if (!result.ok) throw new Error(result.error);
      await refresh();
      message.success('Token revoked. Any device using it was disconnected.');
    } catch (err) {
      message.error(`Failed to revoke: ${(err as Error).message}`);
    }
  }

  // Rotate = mint a replacement carrying the same label and user
  // binding, THEN revoke the old one. Mint-first means a mid-rotation
  // failure leaves the device's existing token still valid rather than
  // locking it out. The revoke disconnects the device's live socket, so
  // it must reconnect with the new token.
  async function handleRotate(t: TokenRow): Promise<void> {
    setRotatingId(t.id);
    try {
      const minted = await hostBridge.call('oh.daemon.tokens.mint', { label: t.label, userId: t.userId });
      if (!minted.ok) throw new Error(minted.error);
      const revoked = await hostBridge.call('oh.daemon.tokens.revoke', { tokenId: t.id });
      if (!revoked.ok) throw new Error(revoked.error);
      setMintResult({ open: true, secret: minted.secret, tokenId: minted.tokenId, rotated: true });
      await refresh();
    } catch (err) {
      message.error(`Failed to rotate: ${(err as Error).message}`);
    } finally {
      setRotatingId(null);
    }
  }

  function dismissMintModal(): void {
    setMintResult({ open: false, secret: '', tokenId: '', rotated: false });
  }

  async function copySecret(): Promise<void> {
    try {
      await navigator.clipboard.writeText(mintResult.secret);
      message.success('Copied to clipboard');
    } catch {
      message.error('Clipboard access denied — copy the value manually');
    }
  }

  return (
    <section style={{ marginBottom: 12 }}>
      <header style={{ marginBottom: 6, padding: '0 2px' }}>
        <h3
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.3,
            textTransform: 'uppercase',
            color: themeToken.colorTextSecondary,
          }}
        >
          Paired devices
        </h3>
        <div style={{ fontSize: 11, color: themeToken.colorTextTertiary, marginTop: 1 }}>
          Each device that connects to this daemon authenticates with an access token. Connected devices are
          highlighted; rotate a token to issue a fresh secret and retire the old one.
        </div>
      </header>
      <div
        className="settings-card"
        style={{
          background: themeToken.colorBgContainer,
          border: `1px solid ${themeToken.colorBorderSecondary}`,
          borderRadius: 10,
          padding: 12,
        }}
      >
        <Form
          form={mintForm}
          layout="inline"
          onFinish={handleMint}
          initialValues={{ label: '' }}
          style={{ marginBottom: tokens.length > 0 ? 12 : 0 }}
        >
          <Form.Item name="label" style={{ flex: 1, marginRight: 8 }}>
            <Input
              placeholder="Label (optional) — e.g. 'alice's phone'"
              maxLength={64}
              data-testid="daemon-tokens-mint-label"
            />
          </Form.Item>
          {bindableUsers.length > 0 && (
            <Form.Item name="userId" style={{ minWidth: 180, marginRight: 8 }}>
              <Select
                placeholder="Bind to user (optional)"
                allowClear
                showSearch
                optionFilterProp="label"
                options={bindableUsers.map((u) => ({ value: u.userId, label: u.displayName }))}
                onOpenChange={(open) => {
                  if (open) void loadBindableUsers();
                }}
              />
            </Form.Item>
          )}
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" loading={minting} data-testid="daemon-tokens-mint">
              Generate token
            </Button>
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, marginLeft: 8 }}>
            <Button onClick={() => setPairOpen(true)}>Pair a device</Button>
          </Form.Item>
        </Form>
        <div style={{ fontSize: 11, color: themeToken.colorTextTertiary, marginBottom: tokens.length > 0 ? 12 : 0 }}>
          Both add a token below. <strong>Generate token</strong> shows you the secret to copy and paste into the
          device yourself. <strong>Pair a device</strong> shows a short code the device enters under Settings →
          Backend → Pair with a code (or opens a link, as a fallback) — use it when someone else sets up the device.
        </div>
        {tokens.length === 0 ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            No devices yet. Generate a token and paste it into the device's Settings → Backend, or pair a device and
            have it enter the code there.
          </Typography.Text>
        ) : (
          <List
            size="small"
            dataSource={[...tokens].sort((a, b) => b.createdAt - a.createdAt)}
            renderItem={(t) => {
              const isRevoked = t.revokedAt !== null;
              const isConnected = !isRevoked && connectedIds.has(t.id);
              const boundUser = t.userId ? (bindableUsers.find((u) => u.userId === t.userId)?.displayName ?? shortenId(t.userId)) : null;
              return (
                <List.Item
                  data-testid={`daemon-token-row-${t.id}`}
                  actions={
                    isRevoked
                      ? [
                          <Tag key="revoked" color="default">
                            Revoked {formatTimestamp(t.revokedAt)}
                          </Tag>,
                        ]
                      : [
                          <Popconfirm
                            key="rotate"
                            title="Rotate this token?"
                            description="A fresh secret is minted and the current one is revoked. The device must be given the new token before it can reconnect."
                            okText="Rotate"
                            cancelText="Cancel"
                            onConfirm={() => handleRotate(t)}
                          >
                            <Button type="link" size="small" loading={rotatingId === t.id}>
                              Rotate
                            </Button>
                          </Popconfirm>,
                          <Popconfirm
                            key="revoke"
                            title="Revoke this token?"
                            description="Any device currently using it is disconnected immediately and can't reconnect."
                            okText="Revoke"
                            cancelText="Cancel"
                            okButtonProps={{ danger: true }}
                            onConfirm={() => handleRevoke(t.id)}
                          >
                            <Button type="link" size="small" danger data-testid={`daemon-token-revoke-${t.id}`}>
                              Revoke
                            </Button>
                          </Popconfirm>,
                        ]
                  }
                >
                  <List.Item.Meta
                    title={
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13 }}>
                          {t.label || <Typography.Text type="secondary">(unlabeled)</Typography.Text>}
                        </span>
                        {isConnected && (
                          <Tag color="green" style={{ marginInlineEnd: 0 }}>
                            Connected
                          </Tag>
                        )}
                      </span>
                    }
                    description={
                      <span style={{ fontSize: 11, color: themeToken.colorTextTertiary }}>
                        id {shortenId(t.id)} · created {formatTimestamp(t.createdAt)} · last used{' '}
                        {formatTimestamp(t.lastUsedAt)}
                        {boundUser && <> · user {boundUser}</>}
                      </span>
                    }
                  />
                </List.Item>
              );
            }}
          />
        )}
      </div>

      <Modal
        open={mintResult.open}
        title={mintResult.rotated ? 'Copy the rotated token now' : 'Copy this token now'}
        closable={false}
        maskClosable={false}
        keyboard={false}
        onCancel={dismissMintModal}
        footer={[
          <Button key="copy" type="default" onClick={copySecret}>
            Copy
          </Button>,
          <Button key="done" type="primary" onClick={dismissMintModal} data-testid="daemon-tokens-secret-saved">
            I've saved it
          </Button>,
        ]}
        width={520}
      >
        <Typography.Paragraph>
          {mintResult.rotated
            ? 'The previous token is now revoked — give this new secret to the device so it can reconnect. '
            : ''}
          The daemon stores only a hash of this value. Once this dialog closes the secret cannot be recovered — if you
          lose it, revoke the token and mint a new one.
        </Typography.Paragraph>
        <Input.TextArea
          value={mintResult.secret}
          readOnly
          autoSize
          style={{ fontFamily: 'monospace', fontSize: 12 }}
          onFocus={(e) => e.currentTarget.select()}
          data-testid="daemon-tokens-secret"
        />
      </Modal>

      <PairDeviceModal
        open={pairOpen}
        onClose={() => {
          setPairOpen(false);
          void refresh();
        }}
      />
    </section>
  );
};

export default DaemonTokensSection;
