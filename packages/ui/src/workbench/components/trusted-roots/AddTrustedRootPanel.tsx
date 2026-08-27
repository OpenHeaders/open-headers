/**
 * AddTrustedRootPanel — the paste → summary → Add flow. The parsed
 * summary shows before anything is committed; a leaf is refused with
 * the reason and Add stays disabled; a chain adds as ONE root.
 */

import type { CertificateSummary } from '@openheaders/core/utils';
import { Alert, Button, Input, Typography, theme } from 'antd';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { formatFingerprint, subjectCommonName } from './add-gate';
import { useCertificateSummary } from './use-certificate-summary';

const { Text } = Typography;

interface AddTrustedRootPanelProps {
  onAdd: (input: { name: string; certPem: string }) => void;
  onCancel: () => void;
}

const AddTrustedRootPanel: React.FC<AddTrustedRootPanelProps> = ({ onAdd, onCancel }) => {
  const t = useT();
  const { token } = theme.useToken();
  const [pem, setPem] = useState('');
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const state = useCertificateSummary(pem);
  const gate = state.status === 'settled' ? state.gate : null;
  const summary: CertificateSummary | null = gate && 'summary' in gate ? gate.summary : null;

  // The name follows the subject CN until the user types one.
  useEffect(() => {
    if (!nameTouched) setName(summary ? subjectCommonName(summary.subject) : '');
  }, [summary, nameTouched]);

  const canAdd = gate?.ok === true && name.trim().length > 0;

  const summaryRow = (label: string, value: string, mono = false) => (
    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8, fontSize: 12 }}>
      <Text type="secondary">{label}</Text>
      <Text style={mono ? { fontFamily: token.fontFamilyCode, wordBreak: 'break-all' } : undefined}>{value}</Text>
    </div>
  );

  return (
    <div
      data-testid="trusted-root-add-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 16,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        background: token.colorFillQuaternary,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Text strong style={{ fontSize: 12 }}>
          {t('workbench.trustedRoots.add.pemLabel')}
        </Text>
        <Input.TextArea
          value={pem}
          onChange={(e) => setPem(e.target.value)}
          rows={7}
          placeholder={t('workbench.trustedRoots.add.pemPlaceholder')}
          style={{ fontFamily: token.fontFamilyCode, fontSize: 12 }}
          spellCheck={false}
          data-testid="trusted-root-pem-input"
        />
      </div>

      {pem.trim() && state.status === 'pending' && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('workbench.trustedRoots.add.parsing')}
        </Text>
      )}
      {gate && !gate.ok && gate.reason === 'invalid' && (
        <Alert type="error" showIcon message={t('workbench.trustedRoots.add.invalid', { message: gate.message })} />
      )}
      {gate && !gate.ok && gate.reason === 'not-ca' && (
        <Alert type="error" showIcon message={t('workbench.trustedRoots.add.notCa')} />
      )}
      {summary && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {summaryRow(t('workbench.trustedRoots.add.summary.subject'), summary.subject)}
          {summaryRow(t('workbench.trustedRoots.add.summary.issuer'), summary.issuer)}
          {summaryRow(
            t('workbench.trustedRoots.add.summary.fingerprint'),
            formatFingerprint(summary.fingerprintSha256),
            true,
          )}
          {summaryRow(t('workbench.trustedRoots.add.summary.validFrom'), new Date(summary.notBefore).toLocaleString())}
          {summaryRow(t('workbench.trustedRoots.add.summary.validUntil'), new Date(summary.notAfter).toLocaleString())}
          {summary.chainLength > 1 &&
            summaryRow(
              t('workbench.trustedRoots.add.summary.chain'),
              t('workbench.trustedRoots.row.chain', { count: summary.chainLength }),
            )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Text strong style={{ fontSize: 12 }}>
          {t('workbench.trustedRoots.add.nameLabel')}
        </Text>
        <Input
          value={name}
          onChange={(e) => {
            setNameTouched(true);
            setName(e.target.value);
          }}
          placeholder={t('workbench.trustedRoots.add.namePlaceholder')}
          style={{ maxWidth: 360 }}
          data-testid="trusted-root-name-input"
        />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <Button
          type="primary"
          disabled={!canAdd}
          onClick={() => onAdd({ name: name.trim(), certPem: pem.trim() })}
          data-testid="trusted-root-add-confirm"
        >
          {t('workbench.trustedRoots.add.confirm')}
        </Button>
        <Button onClick={onCancel}>{t('workbench.trustedRoots.add.cancel')}</Button>
      </div>
    </div>
  );
};

export default AddTrustedRootPanel;
