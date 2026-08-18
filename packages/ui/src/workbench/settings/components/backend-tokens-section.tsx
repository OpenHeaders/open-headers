/**
 * Daemon "Known devices" admin surface (U3.4,
 * the unified-oracle model §4.2 step 4 + the data-plane topologies design §11.4).
 *
 * Visible whenever the desktop is the active back-end (it owns the
 * daemon). Pairing is the universal connection floor — every peer,
 * loopback or LAN, presents a paired token (WS-A1) — so device
 * management can't be gated on a non-loopback bind anymore. Each access
 * token is one device; the list highlights tokens whose peer is
 * connected right now and offers a per-device rotate (mint a
 * replacement, revoke the old one).
 *
 * The ledger is kind-grouped: operator credentials (`apiToken`) render
 * as paired devices; SSO login mints (`session`) render in their own
 * section — signed-in / expires / last-seen / connected — where revoke
 * is the operator's sign-out kill switch (same persist-before-evict
 * path).
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
import { useT } from '@openheaders/ui/context/LocaleContext';
import PairDeviceModal from './pair-device-modal';

/** How often the ledger + connected-peer set are re-polled while this pane is open. */
const POLL_INTERVAL_MS = 3_000;

/** One `tokens.list` row — the ledger projection, hash excluded. */
interface TokenRow {
  id: string;
  label?: string;
  userId?: string;
  kind?: 'session' | 'apiToken';
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

const BackendTokensSection: React.FC = () => {
  const { token: themeToken } = theme.useToken();
  const { message } = AntApp.useApp();
  const t = useT();
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
      message.error(t('workbench.settings.backendTokens.mintFailed', { message: (err as Error).message }));
    } finally {
      setMinting(false);
    }
  }

  async function handleRevoke(tokenId: string, successNote: string): Promise<void> {
    try {
      const result = await hostBridge.call('oh.daemon.tokens.revoke', { tokenId });
      if (!result.ok) throw new Error(result.error);
      await refresh();
      message.success(successNote);
    } catch (err) {
      message.error(t('workbench.settings.backendTokens.revokeFailed', { message: (err as Error).message }));
    }
  }

  // Rotate = mint a replacement carrying the same label and user
  // binding, THEN revoke the old one. Mint-first means a mid-rotation
  // failure leaves the device's existing token still valid rather than
  // locking it out. The revoke disconnects the device's live socket, so
  // it must reconnect with the new token.
  async function handleRotate(row: TokenRow): Promise<void> {
    setRotatingId(row.id);
    try {
      const minted = await hostBridge.call('oh.daemon.tokens.mint', { label: row.label, userId: row.userId });
      if (!minted.ok) throw new Error(minted.error);
      const revoked = await hostBridge.call('oh.daemon.tokens.revoke', { tokenId: row.id });
      if (!revoked.ok) throw new Error(revoked.error);
      setMintResult({ open: true, secret: minted.secret, tokenId: minted.tokenId, rotated: true });
      await refresh();
    } catch (err) {
      message.error(t('workbench.settings.backendTokens.rotateFailed', { message: (err as Error).message }));
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
      message.success(t('shared.toast.copiedToClipboard'));
    } catch {
      message.error(t('shared.toast.copyFailed'));
    }
  }

  // Kind-grouped ledger: operator credentials (generate / pair / rotate)
  // versus SSO login sessions. Rows minted before the marker existed
  // carry no `kind` and read as devices.
  const deviceTokens = tokens.filter((row) => row.kind !== 'session');
  const sessionTokens = tokens.filter((row) => row.kind === 'session');

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
          {t('workbench.settings.backendTokens.sectionTitle')}
        </h3>
        <div style={{ fontSize: 11, color: themeToken.colorTextTertiary, marginTop: 1 }}>
          {t('workbench.settings.backendTokens.sectionBlurb')}
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
          style={{ marginBottom: deviceTokens.length > 0 ? 12 : 0 }}
        >
          <Form.Item name="label" style={{ flex: 1, marginRight: 8 }}>
            <Input
              placeholder={t('workbench.settings.backendTokens.labelPlaceholder')}
              maxLength={64}
              data-testid="backend-tokens-mint-label"
            />
          </Form.Item>
          {bindableUsers.length > 0 && (
            <Form.Item name="userId" style={{ minWidth: 180, marginRight: 8 }}>
              <Select
                placeholder={t('workbench.settings.backendTokens.bindUserPlaceholder')}
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
            <Button type="primary" htmlType="submit" loading={minting} data-testid="backend-tokens-mint">
              {t('workbench.settings.backendTokens.generate')}
            </Button>
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, marginLeft: 8 }}>
            <Button onClick={() => setPairOpen(true)}>{t('workbench.settings.backendTokens.pairDevice')}</Button>
          </Form.Item>
        </Form>
        <div
          style={{ fontSize: 11, color: themeToken.colorTextTertiary, marginBottom: deviceTokens.length > 0 ? 12 : 0 }}
        >
          {t('workbench.settings.backendTokens.explainer.intro')}{' '}
          <strong>{t('workbench.settings.backendTokens.generate')}</strong>{' '}
          {t('workbench.settings.backendTokens.explainer.generateText')}{' '}
          <strong>{t('workbench.settings.backendTokens.pairDevice')}</strong>{' '}
          {t('workbench.settings.backendTokens.explainer.pairText')}
        </div>
        {deviceTokens.length === 0 ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t('workbench.settings.backendTokens.empty')}
          </Typography.Text>
        ) : (
          <List
            size="small"
            dataSource={[...deviceTokens].sort((a, b) => b.createdAt - a.createdAt)}
            renderItem={(row) => {
              const isRevoked = row.revokedAt !== null;
              const isConnected = !isRevoked && connectedIds.has(row.id);
              const boundUser = row.userId
                ? (bindableUsers.find((u) => u.userId === row.userId)?.displayName ?? shortenId(row.userId))
                : null;
              return (
                <List.Item
                  data-testid={`backend-token-row-${row.id}`}
                  actions={
                    isRevoked
                      ? [
                          <Tag key="revoked" color="default">
                            {t('workbench.settings.backendTokens.revokedTag', { when: formatTimestamp(row.revokedAt) })}
                          </Tag>,
                        ]
                      : [
                          <Popconfirm
                            key="rotate"
                            title={t('workbench.settings.backendTokens.rotateConfirmTitle')}
                            description={t('workbench.settings.backendTokens.rotateConfirmBody')}
                            okText={t('workbench.settings.backendTokens.rotate')}
                            cancelText={t('shared.action.cancel')}
                            onConfirm={() => handleRotate(row)}
                          >
                            <Button type="link" size="small" loading={rotatingId === row.id}>
                              {t('workbench.settings.backendTokens.rotate')}
                            </Button>
                          </Popconfirm>,
                          <Popconfirm
                            key="revoke"
                            title={t('workbench.settings.backendTokens.revokeConfirmTitle')}
                            description={t('workbench.settings.backendTokens.revokeConfirmBody')}
                            okText={t('workbench.settings.backendTokens.revoke')}
                            cancelText={t('shared.action.cancel')}
                            okButtonProps={{ danger: true }}
                            onConfirm={() =>
                              handleRevoke(row.id, t('workbench.settings.backendTokens.revokedDevice'))
                            }
                          >
                            <Button type="link" size="small" danger data-testid={`backend-token-revoke-${row.id}`}>
                              {t('workbench.settings.backendTokens.revoke')}
                            </Button>
                          </Popconfirm>,
                        ]
                  }
                >
                  <List.Item.Meta
                    title={
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13 }}>
                          {row.label || (
                            <Typography.Text type="secondary">
                              {t('workbench.settings.backendTokens.unlabeled')}
                            </Typography.Text>
                          )}
                        </span>
                        {isConnected && (
                          <Tag color="green" style={{ marginInlineEnd: 0 }}>
                            {t('workbench.settings.backendTokens.connectedTag')}
                          </Tag>
                        )}
                      </span>
                    }
                    description={
                      <span style={{ fontSize: 11, color: themeToken.colorTextTertiary }}>
                        {t('workbench.settings.backendTokens.meta.device', {
                          id: shortenId(row.id),
                          created: formatTimestamp(row.createdAt),
                          lastUsed: formatTimestamp(row.lastUsedAt),
                        })}
                        {boundUser && <> · {t('workbench.settings.backendTokens.meta.boundUser', { user: boundUser })}</>}
                      </span>
                    }
                  />
                </List.Item>
              );
            }}
          />
        )}
      </div>

      {sessionTokens.length > 0 && (
        <>
          <header style={{ margin: '12px 0 6px', padding: '0 2px' }}>
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
              {t('workbench.settings.backendTokens.ssoTitle')}
            </h3>
            <div style={{ fontSize: 11, color: themeToken.colorTextTertiary, marginTop: 1 }}>
              {t('workbench.settings.backendTokens.ssoBlurb')}
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
            <List
              size="small"
              dataSource={[...sessionTokens].sort((a, b) => b.createdAt - a.createdAt)}
              renderItem={(s) => {
                const isRevoked = s.revokedAt !== null;
                const isExpired = !isRevoked && s.expiresAt !== undefined && s.expiresAt <= Date.now();
                const isConnected = !isRevoked && !isExpired && connectedIds.has(s.id);
                const sessionUser = s.userId
                  ? (bindableUsers.find((u) => u.userId === s.userId)?.displayName ?? shortenId(s.userId))
                  : null;
                return (
                  <List.Item
                    data-testid={`backend-session-row-${s.id}`}
                    actions={
                      isRevoked
                        ? [
                            <Tag key="revoked" color="default">
                              {t('workbench.settings.backendTokens.revokedTag', {
                                when: formatTimestamp(s.revokedAt),
                              })}
                            </Tag>,
                          ]
                        : [
                            <Popconfirm
                              key="revoke"
                              title={t('workbench.settings.backendTokens.revokeSessionConfirmTitle')}
                              description={t('workbench.settings.backendTokens.revokeSessionConfirmBody')}
                              okText={t('workbench.settings.backendTokens.revoke')}
                              cancelText={t('shared.action.cancel')}
                              okButtonProps={{ danger: true }}
                              onConfirm={() =>
                                handleRevoke(s.id, t('workbench.settings.backendTokens.revokedSession'))
                              }
                            >
                              <Button type="link" size="small" danger data-testid={`backend-session-revoke-${s.id}`}>
                                {t('workbench.settings.backendTokens.revoke')}
                              </Button>
                            </Popconfirm>,
                          ]
                    }
                  >
                    <List.Item.Meta
                      title={
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13 }}>
                            {sessionUser ?? s.label ?? (
                              <Typography.Text type="secondary">
                                {t('workbench.settings.backendTokens.unbound')}
                              </Typography.Text>
                            )}
                          </span>
                          {isConnected && (
                            <Tag color="green" style={{ marginInlineEnd: 0 }}>
                              {t('workbench.settings.backendTokens.connectedTag')}
                            </Tag>
                          )}
                          {isExpired && (
                            <Tag color="orange" style={{ marginInlineEnd: 0 }}>
                              {t('workbench.settings.backendTokens.expiredTag')}
                            </Tag>
                          )}
                        </span>
                      }
                      description={
                        <span style={{ fontSize: 11, color: themeToken.colorTextTertiary }}>
                          {t('workbench.settings.backendTokens.meta.session', {
                            signedIn: formatTimestamp(s.createdAt),
                            expires: formatTimestamp(s.expiresAt),
                            lastSeen: formatTimestamp(s.lastUsedAt),
                            id: shortenId(s.id),
                          })}
                        </span>
                      }
                    />
                  </List.Item>
                );
              }}
            />
          </div>
        </>
      )}

      <Modal
        open={mintResult.open}
        title={
          mintResult.rotated
            ? t('workbench.settings.backendTokens.secretTitleRotated')
            : t('workbench.settings.backendTokens.secretTitle')
        }
        closable={false}
        maskClosable={false}
        keyboard={false}
        onCancel={dismissMintModal}
        footer={[
          <Button key="copy" type="default" onClick={copySecret}>
            {t('shared.action.copy')}
          </Button>,
          <Button key="done" type="primary" onClick={dismissMintModal} data-testid="backend-tokens-secret-saved">
            {t('workbench.settings.backendTokens.secretSaved')}
          </Button>,
        ]}
        width={520}
      >
        <Typography.Paragraph>
          {mintResult.rotated
            ? t('workbench.settings.backendTokens.secretBodyRotated')
            : t('workbench.settings.backendTokens.secretBody')}
        </Typography.Paragraph>
        <Input.TextArea
          value={mintResult.secret}
          readOnly
          autoSize
          style={{ fontFamily: 'monospace', fontSize: 12 }}
          onFocus={(e) => e.currentTarget.select()}
          data-testid="backend-tokens-secret"
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

export default BackendTokensSection;
