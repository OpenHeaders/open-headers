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
import type { MessageKey } from '@openheaders/i18n';
import type { ExportSelection } from '@openheaders/core/types';
import { hostBridge } from '@openheaders/core/bridge';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { downloadYaml } from './download-yaml';

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

/**
 * Lightweight passphrase strength signal. Not a security boundary —
 * PBKDF2 + 600k iterations carries the cost. This drives a visual cue
 * so users don't pick "1234".
 */
function passphraseStrength(pass: string): { score: number; labelKey: MessageKey } {
  if (!pass) return { score: 0, labelKey: 'workbench.importExport.export.strengthEmpty' };
  let score = 0;
  if (pass.length >= 8) score += 25;
  if (pass.length >= 16) score += 25;
  if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 15;
  if (/\d/.test(pass)) score += 15;
  if (/[^A-Za-z0-9]/.test(pass)) score += 20;
  const labelKey: MessageKey =
    score < 40
      ? 'workbench.importExport.export.strengthWeak'
      : score < 70
        ? 'workbench.importExport.export.strengthFair'
        : score < 90
          ? 'workbench.importExport.export.strengthGood'
          : 'workbench.importExport.export.strengthStrong';
  return { score: Math.min(100, score), labelKey };
}

const ExportModal: React.FC<ExportModalProps> = ({ open, workspaceId, workspaceName, scope, onCancel }) => {
  const { message } = AntApp.useApp();
  const t = useT();
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
        message.error(resp?.error ?? t('workbench.importExport.export.exportFailed'));
        return null;
      }
      const fingerprints =
        resp.ciphertextFingerprint && resp.keyFingerprint
          ? { ciphertext: resp.ciphertextFingerprint, key: resp.keyFingerprint }
          : null;
      return { yaml: resp.yaml, fingerprints };
    },
    [scope, workspaceId, message, t, vaultMode, passphrase, passphraseHint, strictLiteral],
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
        message.success(t('workbench.importExport.export.exportedShareFingerprints', { filename }));
      } else {
        message.success(t('workbench.importExport.export.exported', { filename }));
        onCancel();
      }
    } finally {
      setBusy(false);
    }
  }, [fetchYaml, filename, message, t, onCancel, vaultOk]);

  const scopeLabel =
    scope.kind === 'workspace' ? (
      <Tag color="blue">{t('workbench.importExport.export.scopeWholeWorkspace')}</Tag>
    ) : (
      <Tag color="purple">{scope.label}</Tag>
    );

  return (
    <Modal
      title={t('workbench.importExport.export.title')}
      open={open}
      onCancel={onCancel}
      destroyOnHidden
      width={620}
      footer={
        <Space>
          <Button onClick={onCancel}>{t('workbench.importExport.export.cancel')}</Button>
          <Button type="primary" icon={<DownloadOutlined />} onClick={onDownload} loading={busy} disabled={!vaultOk}>
            {t('workbench.importExport.export.download')}
          </Button>
        </Space>
      }
    >
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        <div>
          <Paragraph style={{ marginBottom: 4 }}>
            <Text strong>{t('workbench.importExport.export.sourceLabel')} </Text>
            <Text>{workspaceName}</Text>
          </Paragraph>
          <Paragraph style={{ marginBottom: 4 }}>
            <Text strong>{t('workbench.importExport.export.scopeLabel')} </Text>
            {scopeLabel}
          </Paragraph>
          <Paragraph style={{ marginBottom: 0 }}>
            <Text strong>{t('workbench.importExport.export.filenameLabel')} </Text>
            <Text code>{filename}</Text>
          </Paragraph>
        </div>

        <div>
          <Text strong style={{ display: 'block', marginBottom: 6 }}>
            {t('workbench.importExport.export.vaultSecrets')}
          </Text>
          <Radio.Group
            value={vaultMode}
            onChange={(e) => {
              setVaultMode(e.target.value as VaultMode);
              setLastFingerprints(null);
            }}
          >
            <Radio value="omitted">{t('workbench.importExport.export.vaultOmit')}</Radio>
            <Radio value="encrypted">
              <LockOutlined /> {t('workbench.importExport.export.vaultEncrypted')}
            </Radio>
            <Radio value="plaintext">{t('workbench.importExport.export.vaultPlaintext')}</Radio>
          </Radio.Group>
        </div>

        {vaultMode === 'encrypted' && (
          <div>
            <Input.Password
              placeholder={t('workbench.importExport.export.passphrasePlaceholder')}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              autoComplete="new-password"
            />
            <Input.Password
              placeholder={t('workbench.importExport.export.confirmPassphrasePlaceholder')}
              value={confirmPassphrase}
              onChange={(e) => setConfirmPassphrase(e.target.value)}
              autoComplete="new-password"
              status={confirmPassphrase && confirmPassphrase !== passphrase ? 'error' : undefined}
              style={{ marginTop: 6 }}
            />
            <Input
              placeholder={t('workbench.importExport.export.hintPlaceholder')}
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
                {t('workbench.importExport.export.strengthNote', { label: t(strength.labelKey) })}
              </Text>
            </div>
          </div>
        )}

        {vaultMode === 'plaintext' && (
          <Alert
            type="error"
            showIcon
            icon={<WarningOutlined />}
            title={t('workbench.importExport.export.plaintextTitle')}
            description={
              <div>
                <Paragraph style={{ marginBottom: 8 }}>
                  {t('workbench.importExport.export.plaintextUseOnly')}
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
                    {t('workbench.importExport.export.switchToEncrypted')}
                  </Button>
                </Paragraph>
                <Checkbox checked={plaintextAcknowledged} onChange={(e) => setPlaintextAcknowledged(e.target.checked)}>
                  {t('workbench.importExport.export.acknowledgeRisks')}
                </Checkbox>
              </div>
            }
          />
        )}

        {lastFingerprints && (
          <Alert
            type="success"
            showIcon
            title={t('workbench.importExport.export.fingerprintsTitle')}
            description={
              <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 12 }}>
                <div>
                  <Text strong>{t('workbench.importExport.export.ciphertextFingerprint')} </Text>
                  <Text code>{lastFingerprints.ciphertext}</Text>
                </div>
                <div>
                  <Text strong>{t('workbench.importExport.export.keyFingerprint')} </Text>
                  <Text code>{lastFingerprints.key}</Text>
                </div>
                <Paragraph type="secondary" style={{ marginTop: 6, marginBottom: 0, fontSize: 11 }}>
                  {t('workbench.importExport.export.fingerprintMatchNote')}
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
                label: t('workbench.importExport.export.advanced'),
                children: (
                  <Checkbox checked={strictLiteral} onChange={(e) => setStrictLiteral(e.target.checked)}>
                    <Text strong>{t('workbench.importExport.export.strictLiteralLabel')}</Text>
                    <div style={{ fontSize: 11 }}>
                      <Text type="secondary">{t('workbench.importExport.export.strictLiteralHelp')}</Text>
                    </div>
                  </Checkbox>
                ),
              },
            ]}
          />
        )}

        <Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 12 }}>
          <InfoCircleOutlined style={{ marginRight: 6 }} />
          {t('workbench.importExport.export.oauthNote')}
        </Paragraph>
      </Space>
    </Modal>
  );
};

export default ExportModal;
