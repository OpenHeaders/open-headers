/**
 * VersionGateLine — the first line of a gear popover on a 3.1.1
 * request: the 5.0 rule (the values stay saved and are not sent) and
 * the one-click way out, a link button that flips the REQUEST to 5.0
 * (the version lives on the target row, so every 5.0 surface wakes at
 * once). Disabled controls show that nothing works; this line says why
 * — the S7 law's state-line exception, applied where the surface does
 * not explain itself. The user's call, S8.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import { Button, Typography, theme } from 'antd';
import type React from 'react';

const { Text } = Typography;

/** The line, then the popover's hairline under it — the gate is its
 *  own band above the gear's anatomy (the user's call). */
const VersionGateLine: React.FC<{ onSwitchToV5?: () => void; testId: string }> = ({ onSwitchToV5, testId }) => {
  const { token } = theme.useToken();
  const t = useT();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid={testId}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, maxWidth: 400 }}>
        <Text type="secondary" style={{ fontSize: 11 }}>
          {t('workbench.editors.mqtt.props.v5Note')}
        </Text>
        {onSwitchToV5 !== undefined && (
          <Button
            size="small"
            type="link"
            style={{ fontSize: 11, padding: 0, height: 'auto', whiteSpace: 'nowrap' }}
            onClick={onSwitchToV5}
            data-testid={`${testId}-switch`}
          >
            {t('workbench.editors.mqtt.props.v5Switch')}
          </Button>
        )}
      </div>
      <div style={{ height: 1, background: token.colorSplit }} />
    </div>
  );
};

export default VersionGateLine;
