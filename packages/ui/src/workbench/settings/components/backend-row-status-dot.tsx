/**
 * The status dot every "Synced with" row leads with — colour by state,
 * the slot's live message (or the state word) as its tooltip.
 */

import { Tooltip, theme } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { BACKEND_ROW_STATUS_LABEL, type BackendRowStatus } from './use-backend-row-status';

export const BackendRowStatusDot: React.FC<{ status: BackendRowStatus; detail: string | null }> = ({
  status,
  detail,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const color: Record<BackendRowStatus, string> = {
    connected: token.colorSuccess,
    connecting: token.colorWarning,
    'auth-required': token.colorWarning,
    error: token.colorError,
    off: token.colorTextQuaternary,
  };
  return (
    <Tooltip title={detail ?? t(BACKEND_ROW_STATUS_LABEL[status])}>
      <span
        role="status"
        aria-label={t(BACKEND_ROW_STATUS_LABEL[status])}
        style={{
          flex: 'none',
          width: 8,
          height: 8,
          borderRadius: 999,
          background: color[status],
          display: 'inline-block',
        }}
      />
    </Tooltip>
  );
};
