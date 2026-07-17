/**
 * Vault decryption blocks — encrypted prompt, decrypted-success banner,
 * partial-decrypt fail-soft summary.
 */

import { CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import type { WorkspaceExport } from '@openheaders/core/workspace-export';
import { Alert, Button, Input, Space, Tag, Typography } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';

const { Text, Paragraph } = Typography;

export const VaultEncryptedBlock: React.FC<{
  envelope: WorkspaceExport;
  passphrase: string;
  onChangePassphrase: (v: string) => void;
  onDecrypt: () => void;
  decrypting: boolean;
  error: string | null;
}> = ({ envelope, passphrase, onChangePassphrase, onDecrypt, decrypting, error }) => {
  const t = useT();
  const secretCount = envelope.meta.counts.secrets;
  const hint = envelope.secrets?.encryption.kind === 'pbkdf2-aes-gcm' ? envelope.secrets.encryption.hint : undefined;
  return (
    <Alert
      type="info"
      showIcon
      title={t('workbench.importExport.vault.encryptedTitle', { count: secretCount })}
      description={
        <Space orientation="vertical" size={6} style={{ width: '100%' }}>
          {hint && (
            <Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 12 }}>
              <Text strong>{t('workbench.importExport.vault.hintFromSender')} </Text>
              <Text>{hint}</Text>
            </Paragraph>
          )}
          <Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 12 }}>
            {t('workbench.importExport.vault.enterPassphrase')}
          </Paragraph>
          <Input.Password
            placeholder={t('workbench.importExport.vault.passphrasePlaceholder')}
            value={passphrase}
            onChange={(e) => onChangePassphrase(e.target.value)}
            onPressEnter={() => {
              if (passphrase) onDecrypt();
            }}
            autoComplete="off"
          />
          <Button type="primary" size="small" loading={decrypting} disabled={!passphrase} onClick={onDecrypt}>
            {t('workbench.importExport.vault.decrypt')}
          </Button>
          {error && (
            <Text type="danger" style={{ fontSize: 12 }}>
              {error}
            </Text>
          )}
        </Space>
      }
    />
  );
};

export const VaultDecryptedBanner: React.FC<{
  fingerprints: { ciphertext: string; key: string };
  secretCount: number;
}> = ({ fingerprints, secretCount }) => {
  const t = useT();
  return (
    <Alert
      type="success"
      showIcon
      icon={<CheckCircleOutlined />}
      title={t('workbench.importExport.vault.decryptedTitle', { count: secretCount })}
      description={
        <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 12 }}>
          <div>
            <Text strong>{t('workbench.importExport.vault.keyFingerprint')} </Text>
            <Text code>{fingerprints.key}</Text>
            <Text type="secondary" style={{ marginLeft: 6 }}>
              {t('workbench.importExport.vault.compareWithSender')}
            </Text>
          </div>
          <div>
            <Text strong>{t('workbench.importExport.vault.ciphertextFingerprint')} </Text>
            <Text code>{fingerprints.ciphertext}</Text>
          </div>
        </div>
      }
    />
  );
};

/**
 * Per-secret fail-soft. AES-GCM decoded with the right passphrase but
 * one or more decoded secret entries didn't validate against
 * `VaultSecretSchema`. The importer's vault path will only see the
 * survivors; this panel just tells the user what got dropped.
 */
export const VaultPartialDecryptPanel: React.FC<{ drops: { index: number; reason: string }[] }> = ({ drops }) => {
  const t = useT();
  return (
    <Alert
      type="warning"
      showIcon
      icon={<ExclamationCircleOutlined />}
      title={t('workbench.importExport.vault.partialTitle', { count: drops.length })}
      description={
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          {drops.slice(0, 6).map((d) => (
            <li key={d.index} style={{ fontSize: 11 }}>
              <Tag>#{d.index}</Tag>
              <Text>{d.reason}</Text>
            </li>
          ))}
          {drops.length > 6 && (
            <li style={{ fontSize: 11 }}>
              <Text type="secondary">{t('workbench.importExport.vault.andMore', { count: drops.length - 6 })}</Text>
            </li>
          )}
        </ul>
      }
    />
  );
};
