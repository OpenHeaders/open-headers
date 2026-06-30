/**
 * ExportModal — emit a workspace-export envelope as a downloaded YAML file.
 *
 * Vault include modes (design §3.1 / §3.2 / §3.3):
 *   - Omit (default) — no vault in the envelope.
 *   - Encrypted (passphrase) — PBKDF2-HMAC-SHA256 → AES-GCM-256, fresh
 *     12-byte IV per export, 600k iterations. Sender sees a ciphertext
 *     fingerprint + key fingerprint to share out-of-band so the recipient
 *     can confirm "we typed the same passphrase".
 *   - Plaintext (advanced) — secrets ride in the envelope verbatim. Red
 *     banner + "I understand" gate.
 *
 * Filename: `<workspace-slug>-<scope>.openheaders.yaml`. The double
 * extension keeps editor syntax-highlighting while making the file
 * recognizable to the importer's drag-drop handler.
 */

import { DownloadOutlined, InfoCircleOutlined, LockOutlined, WarningOutlined } from '@ant-design/icons';
import { slugify } from '@openheaders/core/utils';
import {
  Alert,
  App as AntApp,
  Button,
  Checkbox,
  Collapse,
  Input,
  Modal,
  Progress,
  Radio,
  Space,
  Tag,
  Typography,
} from 'antd';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import type { ExportSelection } from '@openheaders/core/types';
import { hostBridge } from '@openheaders/core/bridge';

const { Text, Paragraph } = Typography;

/**
 * Modal-level scope description: `'workspace'` for the whole-workspace
 * export and `'selection'` for any single-entity / multi-select / right-
 * click flow. The modal renders a tag from `selection.label` and forwards
 * `selection.entities` (per-entity-type uid lists) to the SW gatherer,
 * which auto-expands collections / folders to descendants.
 *
 * `slug` drives the filename suffix (`<workspace>-<slug>.openheaders.yaml`)
 * and stays free-form so callers can encode "rule-auth-token" / "collection-
 * payments" / "folder-checkout" without having to mirror an enum here.
 */
export type ExportModalScope =
  | { kind: 'workspace' }
  | {
      kind: 'selection';
      label: string;
      slug: string;
      selection: ExportSelection;
    };

type VaultMode = 'omitted' | 'encrypted' | 'plaintext';

interface ExportModalProps {
  open: boolean;
  workspaceId?: string;
  workspaceName: string;
  scope: ExportModalScope;
  onCancel: () => void;
}

interface FingerprintPair {
  ciphertext: string;
  key: string;
}

function buildFilename(workspaceName: string, scope: ExportModalScope): string {
  const slug = slugify(workspaceName) || 'workspace';
  const suffix = scope.kind === 'workspace' ? 'workspace' : scope.slug || 'selection';
  return `${slug}-${suffix}.openheaders.yaml`;
}

function downloadYaml(filename: string, yaml: string): void {
  const blob = new Blob([yaml], { type: 'application/yaml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }
}

/**
 * Lightweight passphrase strength signal. Not a security boundary —
 * PBKDF2 + 600k iterations carries the cost. This drives a visual cue
 * so users don't pick "1234".
 */
function passphraseStrength(pass: string): { score: number; label: string } {
  if (!pass) return { score: 0, label: 'enter a passphrase' };
  let score = 0;
  if (pass.length >= 8) score += 25;
  if (pass.length >= 16) score += 25;
  if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 15;
  if (/\d/.test(pass)) score += 15;
  if (/[^A-Za-z0-9]/.test(pass)) score += 20;
  const label = score < 40 ? 'weak' : score < 70 ? 'fair' : score < 90 ? 'good' : 'strong';
  return { score: Math.min(100, score), label };
}

const ExportModal: React.FC<ExportModalProps> = ({ open, workspaceId, workspaceName, scope, onCancel }) => {
  const { message } = AntApp.useApp();
  const [busy, setBusy] = useState(false);

  const [vaultMode, setVaultMode] = useState<VaultMode>('omitted');
  const [strictLiteral, setStrictLiteral] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [passphraseHint, setPassphraseHint] = useState('');
  const [plaintextAcknowledged, setPlaintextAcknowledged] = useState(false);
  const [lastFingerprints, setLastFingerprints] = useState<FingerprintPair | null>(null);

  const filename = buildFilename(workspaceName, scope);
  const strength = useMemo(() => passphraseStrength(passphrase), [passphrase]);

  const passphraseOk = vaultMode !== 'encrypted' || (passphrase.length >= 8 && passphrase === confirmPassphrase);
  const plaintextOk = vaultMode !== 'plaintext' || plaintextAcknowledged;
  const vaultOk = passphraseOk && plaintextOk;

  const fetchYaml = useCallback(
    async (): Promise<{ yaml: string; fingerprints: FingerprintPair | null } | null> => {
      const swScope =
        scope.kind === 'workspace'
          ? { kind: 'workspace' as const }
          : {
              kind: 'selection' as const,
              selection: scope.selection,
              ...(strictLiteral ? { strictLiteral: true } : {}),
            };
      const resp = await hostBridge.call('exportWorkspace', {
        workspaceId,
        scope: swScope,
        vaultMode,
        ...(vaultMode === 'encrypted' ? { passphrase, ...(passphraseHint ? { passphraseHint } : {}) } : {}),
      });
      if (!resp?.success || !resp.yaml) {
        message.error(resp?.error ?? 'Export failed');
        return null;
      }
      const fingerprints =
        resp.ciphertextFingerprint && resp.keyFingerprint
          ? { ciphertext: resp.ciphertextFingerprint, key: resp.keyFingerprint }
          : null;
      return { yaml: resp.yaml, fingerprints };
    },
    [scope, workspaceId, message, vaultMode, passphrase, passphraseHint, strictLiteral],
  );

  const onDownload = useCallback(async () => {
    if (!vaultOk) return;
    setBusy(true);
    try {
      const result = await fetchYaml();
      if (!result) return;
      downloadYaml(filename, result.yaml);
      if (result.fingerprints) {
        setLastFingerprints(result.fingerprints);
        message.success(`Exported ${filename} — share fingerprints with recipient`);
      } else {
        message.success(`Exported ${filename}`);
        onCancel();
      }
    } finally {
      setBusy(false);
    }
  }, [fetchYaml, filename, message, onCancel, vaultOk]);

  const scopeLabel =
    scope.kind === 'workspace' ? <Tag color="blue">Whole workspace</Tag> : <Tag color="purple">{scope.label}</Tag>;

  return (
    <Modal
      title="Export"
      open={open}
      onCancel={onCancel}
      destroyOnHidden
      width={620}
      footer={
        <Space>
          <Button onClick={onCancel}>Cancel</Button>
          <Button type="primary" icon={<DownloadOutlined />} onClick={onDownload} loading={busy} disabled={!vaultOk}>
            Download
          </Button>
        </Space>
      }
    >
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        <div>
          <Paragraph style={{ marginBottom: 4 }}>
            <Text strong>Source: </Text>
            <Text>{workspaceName}</Text>
          </Paragraph>
          <Paragraph style={{ marginBottom: 4 }}>
            <Text strong>Scope: </Text>
            {scopeLabel}
          </Paragraph>
          <Paragraph style={{ marginBottom: 0 }}>
            <Text strong>Filename: </Text>
            <Text code>{filename}</Text>
          </Paragraph>
        </div>

        <div>
          <Text strong style={{ display: 'block', marginBottom: 6 }}>
            Vault secrets
          </Text>
          <Radio.Group
            value={vaultMode}
            onChange={(e) => {
              setVaultMode(e.target.value as VaultMode);
              setLastFingerprints(null);
            }}
          >
            <Radio value="omitted">Omit (default)</Radio>
            <Radio value="encrypted">
              <LockOutlined /> Encrypted (passphrase)
            </Radio>
            <Radio value="plaintext">Plaintext (advanced)</Radio>
          </Radio.Group>
        </div>

        {vaultMode === 'encrypted' && (
          <div>
            <Input.Password
              placeholder="Passphrase"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              autoComplete="new-password"
            />
            <Input.Password
              placeholder="Confirm passphrase"
              value={confirmPassphrase}
              onChange={(e) => setConfirmPassphrase(e.target.value)}
              autoComplete="new-password"
              status={confirmPassphrase && confirmPassphrase !== passphrase ? 'error' : undefined}
              style={{ marginTop: 6 }}
            />
            <Input
              placeholder="Optional hint (visible to recipient — never the passphrase itself)"
              value={passphraseHint}
              onChange={(e) => setPassphraseHint(e.target.value)}
              maxLength={2048}
              style={{ marginTop: 6 }}
            />
            <div style={{ marginTop: 6 }}>
              <Progress
                percent={strength.score}
                size="small"
                showInfo={false}
                strokeColor={strength.score < 40 ? '#ff4d4f' : strength.score < 70 ? '#faad14' : '#52c41a'}
              />
              <Text type="secondary" style={{ fontSize: 11 }}>
                Passphrase strength: {strength.label}. Share the passphrase out-of-band (Signal, password manager,
                voice). Anyone with the passphrase can read every secret in this export.
              </Text>
            </div>
          </div>
        )}

        {vaultMode === 'plaintext' && (
          <Alert
            type="error"
            showIcon
            icon={<WarningOutlined />}
            title="Plaintext secrets are readable by anyone who sees this file"
            description={
              <div>
                <Paragraph style={{ marginBottom: 8 }}>
                  Use only when sharing with a system you fully trust (e.g. backup to your own encrypted drive).
                </Paragraph>
                <Paragraph style={{ marginBottom: 8 }}>
                  <Button
                    size="small"
                    type="primary"
                    icon={<LockOutlined />}
                    onClick={() => {
                      setVaultMode('encrypted');
                      setPlaintextAcknowledged(false);
                      setLastFingerprints(null);
                    }}
                  >
                    Switch to encrypted (recommended)
                  </Button>
                </Paragraph>
                <Checkbox checked={plaintextAcknowledged} onChange={(e) => setPlaintextAcknowledged(e.target.checked)}>
                  I understand the risks
                </Checkbox>
              </div>
            }
          />
        )}

        {lastFingerprints && (
          <Alert
            type="success"
            showIcon
            title="Encrypted — share these fingerprints with the recipient"
            description={
              <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 12 }}>
                <div>
                  <Text strong>Ciphertext fingerprint: </Text>
                  <Text code>{lastFingerprints.ciphertext}</Text>
                </div>
                <div>
                  <Text strong>Key fingerprint: </Text>
                  <Text code>{lastFingerprints.key}</Text>
                </div>
                <Paragraph type="secondary" style={{ marginTop: 6, marginBottom: 0, fontSize: 11 }}>
                  After the recipient enters the passphrase, they'll see the same key fingerprint if it matches yours.
                </Paragraph>
              </div>
            }
          />
        )}

        {scope.kind === 'selection' && (
          <Collapse
            size="small"
            items={[
              {
                key: 'advanced',
                label: 'Advanced',
                children: (
                  <Checkbox checked={strictLiteral} onChange={(e) => setStrictLiteral(e.target.checked)}>
                    <Text strong>Strict literal — export only what I selected</Text>
                    <div style={{ fontSize: 11 }}>
                      <Text type="secondary">
                        By default, picking a collection or folder pulls in every descendant plus parent containers so
                        the import stands on its own. With strict literal on, only the picked uids ship — the recipient
                        sees missing-deps for anything you didn't include.
                      </Text>
                    </div>
                  </Checkbox>
                ),
              },
            ]}
          />
        )}

        <Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 12 }}>
          <InfoCircleOutlined style={{ marginRight: 6 }} />
          OAuth client secrets are always omitted regardless of vault mode. The recipient enters their own at first
          auth.
        </Paragraph>
      </Space>
    </Modal>
  );
};

export default ExportModal;
