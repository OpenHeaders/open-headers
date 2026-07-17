/**
 * Friendly error state for the gRPC result pane — the HTTP
 * ResponseErrorState's centered grey-icon family: a humanized title,
 * a guidance sentence, and the failure detail in a soft red chip.
 *
 * Two flavors: a non-OK gRPC STATUS (the wire answered; the status
 * name is the title, the server's `grpc-message` is the chip) and a
 * LOCAL failure (the call never produced a response head — transport,
 * encode, TLS; the classified `snapshot.error` is the chip). Status
 * names are protocol identifiers, so the title derives from them
 * (`INVALID_ARGUMENT` → "Invalid argument") rather than a copy
 * catalog — same posture as HTTP status lines.
 */

import { DisconnectOutlined, WarningOutlined } from '@ant-design/icons';
import { GRPC_STATUS_NAMES, grpcStatusLabel } from '@openheaders/core/proto';
import { Typography, theme } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';

const { Text } = Typography;

/** `INVALID_ARGUMENT` → "Invalid argument"; unknown codes fall back to
 *  the bare `3`-style label. */
export function humanizeGrpcStatus(status: number): string {
  const name = GRPC_STATUS_NAMES[status];
  if (name === undefined) return grpcStatusLabel(status);
  const words = name.replace(/_/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const GrpcResponseErrorState: React.FC<{
  /** Non-OK wire status; null for local (pre-head) failures. */
  status: number | null;
  /** Server `grpc-message` (status flavor) or classified local error. */
  detail: string | undefined;
}> = ({ status, detail }) => {
  const { token } = theme.useToken();
  const t = useT();
  return (
    <div
      className="rules-thin-scrollbar"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        minHeight: 0,
        padding: 24,
        textAlign: 'center',
        overflowY: 'auto',
      }}
      data-testid="grpc-response-error-state"
    >
      {status !== null ? (
        <WarningOutlined style={{ fontSize: 20, color: token.colorTextQuaternary }} />
      ) : (
        <DisconnectOutlined style={{ fontSize: 20, color: token.colorTextQuaternary }} />
      )}
      <Text strong style={{ fontSize: 12 }}>
        {status !== null ? humanizeGrpcStatus(status) : t('workbench.editors.grpc.response.error.title')}
      </Text>
      <Text type="secondary" style={{ fontSize: 12, maxWidth: 460 }}>
        {status !== null
          ? t('workbench.editors.grpc.response.error.statusGuidance')
          : t('workbench.editors.grpc.response.error.localGuidance')}
      </Text>
      {detail !== undefined && detail !== '' && (
        <div
          style={{
            maxWidth: 520,
            padding: '6px 14px',
            borderRadius: 6,
            background: token.colorErrorBg,
            border: `1px solid ${token.colorErrorBorder}`,
            color: token.colorErrorText,
            fontSize: 12,
            wordBreak: 'break-word',
          }}
          data-testid="grpc-response-error-detail"
        >
          {detail}
        </div>
      )}
    </div>
  );
};

export default GrpcResponseErrorState;
