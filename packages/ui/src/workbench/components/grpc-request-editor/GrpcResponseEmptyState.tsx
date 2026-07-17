/**
 * Placeholder shown in the gRPC result pane before the first Invoke
 * (and while a unary invoke is in flight) — the HTTP ResponsePanel's
 * empty-state posture: the pane stays attached so the divider is
 * reachable from the start.
 */

import { CaretRightOutlined, LoadingOutlined } from '@ant-design/icons';
import { Typography, theme } from 'antd';
import type React from 'react';
import { ShortcutKbd } from '@openheaders/ui/components/ShortcutKbd';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { isMac } from '@openheaders/ui/shared/platform';

const { Text } = Typography;

const INVOKE_SHORTCUT = isMac ? '⌘↵' : 'Ctrl+Enter';

const GrpcResponseEmptyState: React.FC<{ invoking: boolean }> = ({ invoking }) => {
  const { token } = theme.useToken();
  const t = useT();
  return (
    <div
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
      }}
      data-testid="grpc-response-empty"
    >
      {invoking ? (
        <>
          <LoadingOutlined style={{ fontSize: 20, color: token.colorPrimary }} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('workbench.editors.grpc.response.empty.invoking')}
          </Text>
        </>
      ) : (
        <>
          <CaretRightOutlined style={{ fontSize: 20, color: token.colorTextQuaternary }} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('workbench.editors.grpc.response.empty.prompt')}
          </Text>
          <ShortcutKbd label={INVOKE_SHORTCUT} surface="page" size={22} />
        </>
      )}
    </div>
  );
};

export default GrpcResponseEmptyState;
