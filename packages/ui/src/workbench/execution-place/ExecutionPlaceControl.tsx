/**
 * ExecutionPlaceControl — the chip beside Send / Connect / Invoke on
 * every editor (the Execution Place plan, fork 4): "Runs here" / "Runs
 * on the desktop app" / "Runs on <place>", muted when the send runs
 * here with nothing else possible, and the honest state otherwise —
 * "Needs the desktop app" carrying the companion ladder (front the
 * connected app · launch · connect · download — the status row's own
 * actions), "Not available on <place> yet" for a channel the wire does
 * not forward. Click opens the popover: the reason, the page-realm
 * knobs in play, the call to action — and, where the reader offers
 * more than one place, the PICKER (fork 3's per-send layer: this send
 * only; the picked place is what the chip then reads). The primary
 * button beside it never changes its label by place.
 */

import { SelectOutlined } from '@ant-design/icons';
import { getCapability } from '@openheaders/core/capabilities';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { DesktopConnectAction, DesktopDownloadAction, DesktopOpenAppAction } from '@openheaders/ui/shared/status';
import { Button, Popover, Radio, Tag, Typography, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { executionPlaceCopy, executionPlaceOptionLabel } from './execution-place-copy';
import type { ExecutionPlaceCta, ExecutionPlaceResolution, ExecutionPlaceRole } from './resolve-execution-place';

const { Text } = Typography;

export interface ExecutionPlaceControlProps {
  resolution: ExecutionPlaceResolution;
  /** The per-send pick — present where the editor honours one; the
   *  picker renders only when the reader offers more than one place. */
  onPick?: (role: ExecutionPlaceRole) => void;
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

/** The picker's rows: the resolved place first when it runs, then the
 *  other eligible places; under an unsupported pick only the possible
 *  ones (the chip already names the impossible one). */
function pickerRows(resolution: ExecutionPlaceResolution): readonly ExecutionPlaceRole[] {
  return resolution.state === 'ready' ? [resolution.place, ...resolution.alternatives] : resolution.alternatives;
}

const ExecutionPlaceControl: React.FC<ExecutionPlaceControlProps> = ({ resolution, onPick }) => {
  const { token } = theme.useToken();
  const t = useT();
  const copy = executionPlaceCopy(resolution, t);
  const muted = resolution.state === 'ready' && resolution.place === 'here' && resolution.alternatives.length === 0;
  const color = resolution.state === 'needs-companion' ? 'warning' : 'default';
  const action = ctaAction(resolution.cta);
  const rows = onPick !== undefined ? pickerRows(resolution) : [];
  const picker = rows.length > 1 || (rows.length === 1 && resolution.state !== 'ready');

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
          {picker && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {t('shared.executionPlace.picker.title')}
              </Text>
              <Radio.Group
                value={resolution.state === 'ready' ? resolution.place : undefined}
                onChange={(event) => {
                  const picked = rows.find((role) => role === event.target.value);
                  if (picked !== undefined) onPick?.(picked);
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
              >
                {rows.map((role) => (
                  <Radio
                    key={role}
                    value={role}
                    data-testid="execution-place-option"
                    data-role={role}
                    style={{ fontSize: 12 }}
                  >
                    {executionPlaceOptionLabel(role, resolution.serverName ?? null, t)}
                  </Radio>
                ))}
              </Radio.Group>
            </div>
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
