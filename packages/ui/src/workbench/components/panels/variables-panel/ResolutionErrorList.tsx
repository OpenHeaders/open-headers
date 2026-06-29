/**
 * Structured-error list shown below the in-context variable rows. Each
 * entry renders `{{reference}}` + a tag for the failure reason + the
 * resolver's concrete fix hint. The resolver owns hint generation (see
 * `@openheaders/core/variables/resolver.ts`) — this is a rendering layer
 * only.
 */

import { ExclamationCircleOutlined } from '@ant-design/icons';
import type { ResolutionError } from '@openheaders/core/variables';
import { Tag, Tooltip, Typography, theme } from 'antd';

const { Text } = Typography;

const REASON_TAG_COLOR: Record<ResolutionError['reason'], string> = {
  unresolved: 'error',
  'unset-in-scope': 'warning',
  'unknown-namespace': 'magenta',
  'reserved-namespace': 'geekblue',
  'step-out-of-context': 'volcano',
  empty: 'default',
  'invalid-resolved-value': 'warning',
};

const REASON_TAG_LABEL: Record<ResolutionError['reason'], string> = {
  unresolved: 'unresolved',
  'unset-in-scope': 'not in scope',
  'unknown-namespace': 'unknown namespace',
  'reserved-namespace': 'reserved',
  'step-out-of-context': 'step ref out of scope',
  empty: 'empty',
  'invalid-resolved-value': 'invalid value',
};

export function ResolutionErrorList({ errors }: { errors: ResolutionError[] }) {
  const { token } = theme.useToken();
  return (
    <div style={{ marginTop: 14, paddingTop: 10, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
      <Text strong style={{ fontSize: 11, display: 'block', marginBottom: 6, color: token.colorError }}>
        <ExclamationCircleOutlined style={{ marginRight: 4 }} />
        Resolution issues ({errors.length})
      </Text>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {errors.map((e) => (
          <ResolutionErrorRow key={e.reference} error={e} />
        ))}
      </div>
    </div>
  );
}

function ResolutionErrorRow({ error }: { error: ResolutionError }) {
  const { token } = theme.useToken();
  return (
    <div
      style={{
        padding: '6px 8px',
        background: token.colorErrorBg,
        border: `1px solid ${token.colorErrorBorder}`,
        borderRadius: 4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
        <Tooltip title="The raw reference inside {{…}}">
          <Text code style={{ fontSize: 11 }}>
            {`{{${error.reference}}}`}
          </Text>
        </Tooltip>
        <Tag color={REASON_TAG_COLOR[error.reason]} style={{ fontSize: 10, margin: 0 }}>
          {REASON_TAG_LABEL[error.reason]}
        </Tag>
      </div>
      <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
        {error.hint}
      </Text>
    </div>
  );
}
