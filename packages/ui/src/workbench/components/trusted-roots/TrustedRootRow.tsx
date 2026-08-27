/**
 * TrustedRootRow — one root in the Trusted Certificates table: name
 * (inline rename when the list supports it), subject, fingerprint
 * (mono, copy), expiry with a warning past `notAfter`, remove. Every
 * projected column derives from `certPem` at read time — nothing here
 * is stored. Shared by the workspace list and the device pins.
 */

import { CopyOutlined, DeleteOutlined } from '@ant-design/icons';
import type { TrustedRoot } from '@openheaders/core/types';
import { Button, Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { formatFingerprint, isExpired } from './add-gate';
import { useCertificateSummary } from './use-certificate-summary';

const { Text } = Typography;

export const ROOT_GRID_COLUMNS = 'minmax(140px, 1.2fr) minmax(180px, 2fr) minmax(160px, 1.6fr) 150px 32px';

interface TrustedRootRowProps {
  root: TrustedRoot;
  onRename?: (uid: string, name: string) => void;
  onRemove?: (uid: string) => void;
}

const TrustedRootRow: React.FC<TrustedRootRowProps> = ({ root, onRename, onRemove }) => {
  const t = useT();
  const { token } = theme.useToken();
  const state = useCertificateSummary(root.certPem);
  const [copied, setCopied] = useState(false);
  const summary = state.status === 'settled' && 'summary' in state.gate ? state.gate.summary : null;
  const fingerprint = summary ? formatFingerprint(summary.fingerprintSha256) : '';
  const expired = summary ? isExpired(summary.notAfter, Date.now()) : false;

  const copy = () => {
    void navigator.clipboard.writeText(fingerprint).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div
      data-testid="trusted-root-row"
      style={{
        display: 'grid',
        gridTemplateColumns: ROOT_GRID_COLUMNS,
        alignItems: 'center',
        gap: 12,
        padding: '8px 12px',
        borderTop: `1px solid ${token.colorBorderSecondary}`,
        fontSize: 13,
      }}
    >
      <Text
        ellipsis={{ tooltip: root.name }}
        strong
        editable={
          onRename === undefined
            ? false
            : {
                tooltip: t('workbench.trustedRoots.row.rename'),
                onChange: (name) => {
                  const trimmed = name.trim();
                  if (trimmed && trimmed !== root.name) onRename(root.uid, trimmed);
                },
              }
        }
      >
        {root.name}
      </Text>
      <Text ellipsis={{ tooltip: summary?.subject }} type={summary ? undefined : 'secondary'}>
        {summary?.subject ?? '—'}
      </Text>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
        <Text
          ellipsis={{ tooltip: fingerprint }}
          style={{ fontFamily: token.fontFamilyCode, fontSize: 12, color: token.colorTextSecondary }}
        >
          {fingerprint || '—'}
        </Text>
        {fingerprint && (
          <Tooltip
            title={
              copied ? t('workbench.trustedRoots.row.copied') : t('workbench.trustedRoots.row.copyFingerprint')
            }
          >
            <Button size="small" type="text" icon={<CopyOutlined />} onClick={copy} />
          </Tooltip>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        {summary ? (
          <>
            <Text type={expired ? 'warning' : 'secondary'} style={{ fontSize: 12 }}>
              {new Date(summary.notAfter).toLocaleDateString()}
            </Text>
            {expired && <Tag color="warning">{t('workbench.trustedRoots.row.expired')}</Tag>}
            {summary.chainLength > 1 && (
              <Tag>{t('workbench.trustedRoots.row.chain', { count: summary.chainLength })}</Tag>
            )}
          </>
        ) : (
          <Text type="secondary">—</Text>
        )}
      </div>
      {onRemove === undefined ? (
        <span />
      ) : (
        <Button
          size="small"
          type="text"
          danger
          icon={<DeleteOutlined />}
          aria-label={t('workbench.trustedRoots.row.remove')}
          onClick={() => onRemove(root.uid)}
        />
      )}
    </div>
  );
};

export default TrustedRootRow;
