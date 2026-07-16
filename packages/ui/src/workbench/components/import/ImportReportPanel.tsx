/**
 * ImportReportPanel — drops + transforms readout shared by the
 * stage-2 import modals (Postman, sectioned multi-source). Renders
 * nothing when the report is clean; the re-import diff flow is a
 * separate panel (`ReimportDiffPanel`).
 */

import { InfoCircleOutlined, WarningOutlined } from '@ant-design/icons';
import type { ImportReport } from '@openheaders/core/import';
import { Alert, theme } from 'antd';
import type React from 'react';

const ImportReportPanel: React.FC<{
  report: ImportReport;
  token: ReturnType<typeof theme.useToken>['token'];
}> = ({ report, token }) => {
  if (report.drops.length === 0 && report.transforms.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {report.transforms.length > 0 && (
        <Alert
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          message={`${report.transforms.length} conversion${report.transforms.length === 1 ? '' : 's'} handled automatically`}
          description={
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, maxHeight: 140, overflowY: 'auto', overscrollBehavior: 'none' }}>
              {report.transforms.map((t, i) => (
                <li key={i}>
                  <strong>{t.path}:</strong> <span style={{ color: token.colorTextSecondary }}>{t.from}</span> →{' '}
                  <span style={{ color: token.colorPrimary }}>{t.to}</span>
                  <div style={{ color: token.colorTextTertiary, fontSize: 11 }}>{t.reason}</div>
                </li>
              ))}
            </ul>
          }
        />
      )}
      {report.drops.length > 0 && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          message={`${report.drops.length} item${report.drops.length === 1 ? '' : 's'} dropped`}
          description={
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, maxHeight: 160, overflowY: 'auto' }}>
              {report.drops.map((d, i) => (
                <li key={i}>
                  <strong>{d.path}:</strong> {d.reason}
                  {d.names && d.names.length > 0 && (
                    <div style={{ color: token.colorTextSecondary, fontSize: 11 }}>{d.names.join(' · ')}</div>
                  )}
                  {d.tracking && (
                    <div style={{ color: token.colorTextTertiary, fontSize: 11 }}>tracking: {d.tracking}</div>
                  )}
                </li>
              ))}
            </ul>
          }
        />
      )}
    </div>
  );
};

export default ImportReportPanel;
