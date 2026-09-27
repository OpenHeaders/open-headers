/**
 * ExecutionPlaceControl — the place button after Save on every editor
 * (the Execution Place plan, fork 4): a run glyph and the place's mark
 * (`PlaceMark`), no words — this browser's logo, this machine's OS
 * mark, or the server's own icon. The words live on hover (the chip
 * sentence: "Runs here", "Runs on <place>", "Needs the desktop app",
 * "Not available on <place> yet") and in the click-popover: the
 * reason, the page-realm knobs in play, the call to action — the
 * companion ladder rung (front the connected app · launch · connect ·
 * download, the status row's own actions) — and, where the reader
 * offers more than one place, the PICKER (fork 3's per-send layer:
 * this send only; the picked place is what the mark then shows). The
 * tone carries the state: muted when the send runs here with nothing
 * else possible, the warning colour when the desktop app is needed.
 * The primary button never changes its label by place.
 */

import { FunctionOutlined, SelectOutlined } from '@ant-design/icons';
import { getCapability } from '@openheaders/core/capabilities';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { DesktopConnectAction, DesktopDownloadAction, DesktopOpenAppAction } from '@openheaders/ui/shared/status';
import { Button, Popover, Radio, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { executionPlaceCopy, executionPlaceOptionLabel } from './execution-place-copy';
import { PlaceMark } from './PlaceMark';
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
 *  ones (the mark already names the impossible one). */
function pickerRows(resolution: ExecutionPlaceResolution): readonly ExecutionPlaceRole[] {
  return resolution.state === 'ready' ? [resolution.place, ...resolution.alternatives] : resolution.alternatives;
}

const ExecutionPlaceControl: React.FC<ExecutionPlaceControlProps> = ({ resolution, onPick }) => {
  const { token } = theme.useToken();
  const t = useT();
  const copy = executionPlaceCopy(resolution, t);
  const muted = resolution.state === 'ready' && resolution.place === 'here' && resolution.alternatives.length === 0;
  const warning = resolution.state === 'needs-companion';
  const action = ctaAction(resolution.cta);
  const rows = onPick !== undefined ? pickerRows(resolution) : [];
  const picker = rows.length > 1 || (rows.length === 1 && resolution.state !== 'ready');
  // The hover words yield to the popover — a tooltip over an open
  // popover would sit on top of the very sentence it repeats.
  const [popoverOpen, setPopoverOpen] = useState(false);

  return (
    <Popover
      trigger="click"
      placement="bottomRight"
      onOpenChange={setPopoverOpen}
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
      <span style={{ display: 'inline-flex' }}>
        <Tooltip title={copy.chip} placement="bottom" open={popoverOpen ? false : undefined}>
          <Button
            size="small"
            {...(warning ? { color: 'gold' as const, variant: 'outlined' as const } : {})}
            aria-label={copy.chip}
            data-testid="execution-place-chip"
            data-place={resolution.place}
            data-state={resolution.state}
            data-muted={muted ? 'true' : 'false'}
            style={{ fontSize: 11, paddingInline: 6, ...(muted ? { color: token.colorTextTertiary } : {}) }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, lineHeight: 0 }}>
              <FunctionOutlined />
              <PlaceMark role={resolution.place} size={13} />
            </span>
          </Button>
        </Tooltip>
      </span>
    </Popover>
  );
};

export default ExecutionPlaceControl;
