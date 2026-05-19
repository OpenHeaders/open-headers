/**
 * Daemon access-token admin surface (U3.2,
 * `UNIFIED_ORACLE_MODEL.md` §4.2 + `DATA_PLANE_TOPOLOGIES.md` §11.4).
 *
 * Visible only on the desktop daemon's LAN-peers section while
 * `backend.bindAddress === '0.0.0.0'` — when the daemon is loopback-only
 * there's no token gate to administer. The component is purely a
 * minting + revoke front-end; validation lives in the handshake
 * dispatcher and never touches this UI.
 *
 * Minted secrets are shown exactly once. The "Copy secret" dialog is
 * deliberately styled so the admin can't dismiss it accidentally; once
 * closed, only the hash remains on disk and the secret is recoverable
 * only by minting a fresh one.
 */

import { App as AntApp, Button, Form, Input, List, Modal, Popconfirm, Tag, Typography, theme } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import type React from 'react';
import { hostStorage, OH } from '@openheaders/core/storage';
import {
  listDaemonAuthTokens,
  mintDaemonAuthToken,
  revokeDaemonAuthToken,
} from '@openheaders/core/identity';
import type { DaemonAuthToken } from '@openheaders/core/types';

interface MintModalState {
  open: boolean;
  /** The raw secret returned at mint time. Cleared when the modal closes. */
  secret: string;
  tokenId: string;
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
  const [tokens, setTokens] = useState<readonly DaemonAuthToken[]>([]);
  const [mintForm] = Form.useForm<{ label: string }>();
  const [minting, setMinting] = useState(false);
  const [mintResult, setMintResult] = useState<MintModalState>({ open: false, secret: '', tokenId: '' });

  const refresh = useCallback(async () => {
    const current = await listDaemonAuthTokens();
    setTokens(current);
  }, []);

  useEffect(() => {
    void refresh();
    // Subscribe so any out-of-band write (e.g. another window) keeps
    // this list current.
    const unsubscribe = hostStorage.subscribe(OH.daemonAuthTokens, (next) => {
      setTokens(next ?? []);
    });
    return unsubscribe;
  }, [refresh]);

  async function handleMint(values: { label: string }): Promise<void> {
    setMinting(true);
    try {
      const result = await mintDaemonAuthToken({ label: values.label?.trim() || undefined });
      mintForm.resetFields();
      setMintResult({ open: true, secret: result.secret, tokenId: result.record.id });
      await refresh();
    } catch (err) {
      message.error(`Failed to mint token: ${(err as Error).message}`);
    } finally {
      setMinting(false);
    }
  }

  async function handleRevoke(tokenId: string): Promise<void> {
    try {
      await revokeDaemonAuthToken(tokenId);
      await refresh();
      message.success('Token revoked. Any peer using it will be rejected on next HELLO.');
    } catch (err) {
      message.error(`Failed to revoke: ${(err as Error).message}`);
    }
  }

  function dismissMintModal(): void {
    setMintResult({ open: false, secret: '', tokenId: '' });
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
          Access tokens
        </h3>
        <div style={{ fontSize: 11, color: themeToken.colorTextTertiary, marginTop: 1 }}>
          Long-lived secrets the daemon recognizes. Share one with each peer that needs to connect.
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
            <Input placeholder="Label (optional) — e.g. 'alice's phone'" maxLength={64} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" loading={minting}>
              Generate token
            </Button>
          </Form.Item>
        </Form>
        {tokens.length === 0 ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            No tokens issued yet. Generate one and paste it into the peer's Settings → Backend → Daemon auth token.
          </Typography.Text>
        ) : (
          <List
            size="small"
            dataSource={[...tokens].sort((a, b) => b.createdAt - a.createdAt)}
            renderItem={(t) => {
              const isRevoked = t.revokedAt !== null;
              return (
                <List.Item
                  actions={[
                    isRevoked ? (
                      <Tag key="revoked" color="default">
                        Revoked {formatTimestamp(t.revokedAt)}
                      </Tag>
                    ) : (
                      <Popconfirm
                        key="revoke"
                        title="Revoke this token?"
                        description="Any peer currently using it will be rejected on its next HELLO."
                        okText="Revoke"
                        cancelText="Cancel"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => handleRevoke(t.id)}
                      >
                        <Button type="link" size="small" danger>
                          Revoke
                        </Button>
                      </Popconfirm>
                    ),
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <span style={{ fontSize: 13 }}>
                        {t.label || <Typography.Text type="secondary">(unlabeled)</Typography.Text>}
                      </span>
                    }
                    description={
                      <span style={{ fontSize: 11, color: themeToken.colorTextTertiary }}>
                        id {shortenId(t.id)} · created {formatTimestamp(t.createdAt)} · last used {formatTimestamp(t.lastUsedAt)}
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
        title="Copy this token now"
        closable={false}
        maskClosable={false}
        keyboard={false}
        onCancel={dismissMintModal}
        footer={[
          <Button key="copy" type="default" onClick={copySecret}>
            Copy
          </Button>,
          <Button key="done" type="primary" onClick={dismissMintModal}>
            I've saved it
          </Button>,
        ]}
        width={520}
      >
        <Typography.Paragraph>
          The daemon stores only a hash of this value. Once this dialog closes the secret cannot be recovered — if you
          lose it, revoke the token and mint a new one.
        </Typography.Paragraph>
        <Input.TextArea
          value={mintResult.secret}
          readOnly
          autoSize
          style={{ fontFamily: 'monospace', fontSize: 12 }}
          onFocus={(e) => e.currentTarget.select()}
        />
      </Modal>
    </section>
  );
};

export default DaemonTokensSection;
