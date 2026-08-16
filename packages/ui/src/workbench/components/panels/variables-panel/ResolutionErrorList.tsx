/**
 * Structured-error list shown below the in-context variable rows. Each
 * entry renders `{{reference}}` + a tag for the failure reason + the
 * keyed fix hint (`resolutionHint` over the resolver's structured
 * fields) — this is a rendering layer only.
 */

import { ExclamationCircleOutlined } from '@ant-design/icons';
import type { ResolutionError } from '@openheaders/core/variables';
import type { MessageKey } from '@openheaders/i18n';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { resolutionHint } from '@openheaders/ui/shared/variables';
import { Tag, Tooltip, Typography, theme } from 'antd';

const { Text } = Typography;

const REASON_TAG_COLOR: Record<ResolutionError['reason'], string> = {
  unresolved: 'error',
  'unset-in-scope': 'warning',
  'unknown-namespace': 'magenta',
  'step-out-of-context': 'volcano',
  empty: 'default',
  'invalid-resolved-value': 'warning',
  'secret-authorization-required': 'warning',
  'secret-not-found': 'error',
  'secret-unavailable': 'warning',
};

const REASON_TAG_LABEL: Record<ResolutionError['reason'], MessageKey> = {
  unresolved: 'workbench.variables.panel.errors.reason.unresolved',
  'unset-in-scope': 'workbench.variables.panel.errors.reason.unsetInScope',
  'unknown-namespace': 'workbench.variables.panel.errors.reason.unknownNamespace',
  'step-out-of-context': 'workbench.variables.panel.errors.reason.stepOutOfContext',
  empty: 'workbench.variables.panel.errors.reason.empty',
  'invalid-resolved-value': 'workbench.variables.panel.errors.reason.invalidResolvedValue',
  'secret-authorization-required': 'workbench.variables.panel.errors.reason.secretAuthorizationRequired',
  'secret-not-found': 'workbench.variables.panel.errors.reason.secretNotFound',
  'secret-unavailable': 'workbench.variables.panel.errors.reason.secretUnavailable',
};

export function ResolutionErrorList({ errors }: { errors: ResolutionError[] }) {
  const { token } = theme.useToken();
  const t = useT();
  return (
    <div style={{ marginTop: 14, paddingTop: 10, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
      <Text strong style={{ fontSize: 11, display: 'block', marginBottom: 6, color: token.colorError }}>
        <ExclamationCircleOutlined style={{ marginRight: 4 }} />
        {t('workbench.variables.panel.errors.title', { count: errors.length })}
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
  const t = useT();
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
        <Tooltip title={t('workbench.variables.panel.errors.referenceTooltip')}>
          <Text code style={{ fontSize: 11 }}>
            {`{{${error.reference}}}`}
          </Text>
        </Tooltip>
        <Tag color={REASON_TAG_COLOR[error.reason]} style={{ fontSize: 10, margin: 0 }}>
          {t(REASON_TAG_LABEL[error.reason])}
        </Tag>
      </div>
      <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
        {resolutionHint(t, error)}
      </Text>
    </div>
  );
}
