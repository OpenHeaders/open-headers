/**
 * ExecutionPlaceControl — the chip beside Send / Connect / Invoke on
 * every editor (the Execution Place plan, fork 4): "Runs here" / "Runs
 * on the desktop app" / "Runs on <place>", muted when the send runs
 * here with nothing else possible, and the honest state otherwise —
 * "Needs the desktop app" carrying the companion ladder (front the
 * connected app · launch · connect · download — the status row's own
 * actions), "Not available on <place> yet" for a channel the wire does
 * not forward. Click opens the popover: the reason, the page-realm
 * knobs in play, the call to action. The primary button beside it
 * never changes its label by place.
 */

import { SelectOutlined } from '@ant-design/icons';
import { getCapability } from '@openheaders/core/capabilities';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { DesktopConnectAction, DesktopDownloadAction, DesktopOpenAppAction } from '@openheaders/ui/shared/status';
import { Button, Popover, Tag, Typography, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { executionPlaceCopy } from './execution-place-copy';
import type { ExecutionPlaceCta, ExecutionPlaceResolution } from './resolve-execution-place';

const { Text } = Typography;

export interface ExecutionPlaceControlProps {
  resolution: ExecutionPlaceResolution;
}

/** Front the connected desktop app on its workbench — the S1 answer
 *  for a send only the desktop app can run (Phase D delegates it). */
const DesktopRevealAction: React.FC = () => {
  const t = useT();
  const [revealing, setRevealing] = useState(false);
  const companionReveal = getCapability('companionReveal');
  if (!companionReveal) return null;
  const reveal = async (): Promise<void> => {
    setRevealing(true);
    await companionReveal('workbench');
    setRevealing(false);
  };
  return (
    <Button
      size="small"
      type="primary"
      icon={<SelectOutlined />}
      loading={revealing}
      onClick={() => void reveal()}
      style={{ fontSize: 11 }}
    >
      {t('shared.desktopTeaser.openApp')}
    </Button>
  );
};

function ctaAction(cta: ExecutionPlaceCta): React.ReactNode {
  switch (cta) {
    case 'reveal-desktop-app':
      return <DesktopRevealAction />;
    case 'launch-desktop-app':
      return <DesktopOpenAppAction primary />;
    case 'connect-desktop-app':
      return <DesktopConnectAction />;
    case 'download-desktop-app':
      return <DesktopDownloadAction />;
    case null:
      return null;
  }
}

const ExecutionPlaceControl: React.FC<ExecutionPlaceControlProps> = ({ resolution }) => {
  const { token } = theme.useToken();
  const t = useT();
  const copy = executionPlaceCopy(resolution, t);
  const muted = resolution.state === 'ready' && resolution.place === 'here';
  const color = resolution.state === 'needs-companion' ? 'warning' : 'default';
  const action = ctaAction(resolution.cta);

  return (
    <Popover
      trigger="click"
      placement="bottomRight"
      content={
        <div
          data-testid="execution-place-popover"
          style={{ maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          <Text style={{ fontSize: 12 }}>{copy.reason}</Text>
          {copy.knobs !== null && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {copy.knobs}
            </Text>
          )}
          {action !== null && <span data-testid="execution-place-cta">{action}</span>}
        </div>
      }
    >
      <Tag
        color={color}
        variant={muted ? 'filled' : 'outlined'}
        data-testid="execution-place-chip"
        data-place={resolution.place}
        data-state={resolution.state}
        title={t('shared.executionPlace.info')}
        style={{
          marginInlineEnd: 0,
          cursor: 'pointer',
          fontSize: 11,
          lineHeight: '20px',
          ...(muted ? { color: token.colorTextTertiary, background: 'transparent' } : {}),
        }}
      >
        {copy.chip}
      </Tag>
    </Popover>
  );
};

export default ExecutionPlaceControl;
