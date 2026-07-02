/**
 * The Enabled + Wait-for-fresh toggle row shared by both
 * `LiveVariableEditor` modes.
 *
 * "Enabled" = when off, `{{live.<name>}}` stops resolving (the resolver
 * filter skips disabled LVs). The binding stays in storage so toggling
 * back on is a one-click restore.
 *
 * "Wait for fresh value" (persisted as `requireFreshOnRuleBuild`) — when
 * on, the DNR rule-compile path BLOCKS on a workflow refresh (up to ~5s)
 * so rules always pick up a freshly-fetched value. Off (default) =
 * async-warm: rules use the last cached value and a background refresh
 * runs. The tradeoff is latency vs staleness on cold start.
 */

import { InfoCircleOutlined } from '@ant-design/icons';
import { LIVE_VARIABLE_FIELD } from '@openheaders/ui/shared/awareness';
import { Switch, Tooltip, Typography, theme } from 'antd';
import type React from 'react';

const { Text } = Typography;

const ENABLED_TOOLTIP = 'When off, {{live.NAME}} references stop resolving in rules and requests.';
const FRESH_TOOLTIP =
  'Before applying rules, wait for the backing workflow to finish a refresh (up to ~5s). Off: rules use the last cached value and refresh in the background — faster but can be briefly stale after the extension wakes.';

interface LiveVariableTogglesProps {
  enabled: boolean;
  requireFreshOnRuleBuild: boolean;
  onChangeEnabled: (enabled: boolean) => void;
  onChangeRequireFresh: (requireFreshOnRuleBuild: boolean) => void;
  marginTop?: number;
}

const LiveVariableToggles: React.FC<LiveVariableTogglesProps> = ({
  enabled,
  requireFreshOnRuleBuild,
  onChangeEnabled,
  onChangeRequireFresh,
  marginTop = 4,
}) => {
  const { token } = theme.useToken();
  return (
    <div
      style={{
        display: 'flex',
        gap: 20,
        alignItems: 'center',
        flexWrap: 'wrap',
        marginTop,
        paddingTop: 10,
        borderTop: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <div data-field-path={LIVE_VARIABLE_FIELD.enabled} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Switch size="small" checked={enabled} onChange={onChangeEnabled} />
        <Text style={{ fontSize: 12 }}>Enabled</Text>
        <Tooltip title={ENABLED_TOOLTIP}>
          <InfoCircleOutlined style={{ fontSize: 11, color: token.colorTextTertiary, cursor: 'help' }} />
        </Tooltip>
      </div>
      <div
        data-field-path={LIVE_VARIABLE_FIELD.requireFreshOnRuleBuild}
        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <Switch size="small" checked={requireFreshOnRuleBuild} onChange={onChangeRequireFresh} />
        <Text type="secondary" style={{ fontSize: 12 }}>
          Wait for fresh value
        </Text>
        <Tooltip title={FRESH_TOOLTIP}>
          <InfoCircleOutlined style={{ fontSize: 11, color: token.colorTextTertiary, cursor: 'help' }} />
        </Tooltip>
      </div>
    </div>
  );
};

export default LiveVariableToggles;
