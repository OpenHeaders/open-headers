/**
 * CertificateTable — the bordered header + rows block both trust lists
 * render (workspace certificates, device pins): the four projected
 * columns, the empty line inside the table when there is nothing, one
 * {@link TrustedRootRow} per certificate. Rename and remove are the
 * caller's gestures; absent handlers render the rows read-only.
 */

import type { DeviceTrustedCertificate, TrustedRoot } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Typography, theme } from 'antd';
import type React from 'react';
import TrustedRootRow, { ROOT_GRID_COLUMNS } from './TrustedRootRow';

const { Text } = Typography;

interface CertificateTableProps {
  certificates: ReadonlyArray<TrustedRoot | DeviceTrustedCertificate>;
  emptyTitle: string;
  emptyHint: string;
  onRename?: (uid: string, name: string) => void;
  onRemove?: (uid: string) => void;
  testId?: string;
}

const CertificateTable: React.FC<CertificateTableProps> = ({
  certificates,
  emptyTitle,
  emptyHint,
  onRename,
  onRemove,
  testId = 'trusted-roots',
}) => {
  const t = useT();
  const { token } = theme.useToken();
  const headerCell = (label: string) => (
    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>
      {label}
    </Text>
  );
  return (
    <div
      data-testid={`${testId}-table`}
      style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: token.borderRadiusLG }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: ROOT_GRID_COLUMNS,
          gap: 12,
          padding: '6px 12px',
          background: token.colorFillQuaternary,
        }}
      >
        {headerCell(t('workbench.trustedRoots.header.name'))}
        {headerCell(t('workbench.trustedRoots.header.subject'))}
        {headerCell(t('workbench.trustedRoots.header.fingerprint'))}
        {headerCell(t('workbench.trustedRoots.header.expires'))}
        <span />
      </div>
      {certificates.length === 0 ? (
        <div
          data-testid={`${testId}-empty`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            padding: '16px 12px',
            borderTop: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <Text>{emptyTitle}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {emptyHint}
          </Text>
        </div>
      ) : (
        certificates.map((certificate) => (
          <TrustedRootRow key={certificate.uid} root={certificate} onRename={onRename} onRemove={onRemove} />
        ))
      )}
    </div>
  );
};

export default CertificateTable;
