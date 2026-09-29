/**
 * ExecutionPlaceControl — the place button after Save on every editor
 * (the Execution Place plan, fork 4): a run glyph and the place's mark
 * (`PlaceMark`), no words — this browser's logo, this machine's OS
 * mark, or the server's own icon. The hover carries the standard line
 * ("Runs locally: in this browser extension", "Runs remotely: on
 * <server>", or the honest state); the click-popover carries the
 * ROSTER — every place this host knows, in a fixed order, the
 * available ones selectable, the others disabled with their reason
 * and the rung that would make them available (the desktop ladder:
 * open · connect · download; the Sync page for a server) — under the
 * reason sentence and the knobs in play. A pick is a DRAFT edit of the
 * request's own place (saved with the request, on this device only,
 * by the editor's Save); *Reset to automatic* clears it back to the
 * Settings default. The mark mirrors the picker's selection — the
 * resolved row, else the chosen row the surface cannot honour, else
 * this surface itself. The tone carries the state: muted when the send
 * runs here with nothing else possible, the warning colour when no row
 * can run it. The primary button never changes its label by place.
 * `open` / `onOpenChange` let a disabled primary's hint open the
 * picker.
 */

import { FunctionOutlined, SelectOutlined } from '@ant-design/icons';
import { getCapability } from '@openheaders/core/capabilities';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { DesktopConnectAction, DesktopDownloadAction, DesktopOpenAppAction } from '@openheaders/ui/shared/status';
import { Button, Popover, Radio, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { executionPlaceCopy, executionPlaceRosterLabel, executionPlaceRosterReason } from './execution-place-copy';
import { postSettingsReveal } from '../data/settings-reveal';
import { PlaceMark } from './PlaceMark';
import type {
  ExecutionPlaceCta,
  ExecutionPlacePreference,
  ExecutionPlaceResolution,
  ExecutionPlaceRole,
  ExecutionPlaceRosterRow,
} from './resolve-execution-place';

const { Text } = Typography;

export interface ExecutionPlaceControlProps {
  resolution: ExecutionPlaceResolution;
  /** Every place this host knows for this send — the picker's rows. */
  roster: readonly ExecutionPlaceRosterRow[];
  /** The request's own place (its draft, else its saved value); 'auto' = following Settings. */
  preference: ExecutionPlacePreference;
  /** A pick edits the draft; null resets it to Automatic. Absent = read-only (no picker). */
  onPick?: (role: ExecutionPlaceRole | null) => void;
  /** Controlled popover state — a disabled primary's hint opens the picker. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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

/** The Sync page, where a server is signed in to and connected. */
const OpenSyncAction: React.FC = () => {
  const t = useT();
  return (
    <Button
      size="small"
      onClick={() => postSettingsReveal({ categoryId: 'backendConnections' })}
      data-testid="execution-place-open-sync"
      style={{ fontSize: 11, height: 20, padding: '0 6px' }}
    >
      {t('shared.executionPlace.roster.openSync')}
    </Button>
  );
};

/** The Settings row that withheld the server — this device's own
 *  "Run requests on a server" switch, opened in place. */
const OpenServerSwitchAction: React.FC = () => {
  const t = useT();
  return (
    <Button
      type="link"
      size="small"
      onClick={() => postSettingsReveal({ settingKey: 'requests.allowServerExecution' })}
      data-testid="execution-place-open-server-switch"
      style={{ fontSize: 11, padding: 0, height: 'auto', whiteSpace: 'nowrap' }}
    >
      {t('shared.executionPlace.roster.openSettings')}
    </Button>
  );
};

/** The Server tab of the docs site — setting a server up and joining it. */
const SERVER_DOCS_URL = 'https://docs.openheaders.com/server';

/** The rung of a workspace with no server: the docs on setting one up,
 *  opened outside (the host's external-open path, else a plain tab). */
const SeeDocsAction: React.FC = () => {
  const t = useT();
  const open = (): void => {
    const openUrl = getCapability('openExternalUrl');
    if (openUrl) void openUrl(SERVER_DOCS_URL);
    else window.open(SERVER_DOCS_URL, '_blank', 'noopener');
  };
  return (
    <Button
      type="link"
      size="small"
      onClick={open}
      data-testid="execution-place-see-docs"
      style={{ fontSize: 11, padding: 0, height: 'auto', whiteSpace: 'nowrap' }}
    >
      {t('shared.executionPlace.roster.seeDocs')}
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

/** A disabled row's rung: the desktop ladder, the Sync page for a
 *  server whose wire is down, the server docs for a workspace with no
 *  server, the Settings row for a server this device switched off;
 *  nothing for a kind this surface cannot run. */
function rowAction(row: ExecutionPlaceRosterRow): React.ReactNode {
  if (row.role === 'workspace-server' && row.reason === 'server-not-connected') return <OpenSyncAction />;
  if (row.role === 'workspace-server' && row.reason === 'no-server') return <SeeDocsAction />;
  if (row.role === 'workspace-server' && row.reason === 'server-off') return <OpenServerSwitchAction />;
  return ctaAction(row.cta);
}

const ExecutionPlaceControl: React.FC<ExecutionPlaceControlProps> = ({
  resolution,
  roster,
  preference,
  onPick,
  open,
  onOpenChange,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const copy = executionPlaceCopy(resolution, t);
  const muted = resolution.state === 'ready' && resolution.place === 'here' && resolution.alternatives.length === 0;
  // The warning tone whenever the send will not run as configured — a
  // place this surface needs and lacks, or a chosen place it cannot
  // honour (the user's own switch included).
  const warning = resolution.state !== 'ready';
  // The hover words yield to the popover — a tooltip over an open
  // popover would sit on top of the very sentence it repeats.
  const [innerOpen, setInnerOpen] = useState(false);
  const popoverOpen = open ?? innerOpen;
  const setOpen = (next: boolean): void => {
    setInnerOpen(next);
    onOpenChange?.(next);
  };
  // The selected row: the place the send resolved to, else the
  // preferred role the surface cannot honour (its row stays disabled).
  const selected: ExecutionPlaceRole | undefined =
    resolution.state === 'ready' ? resolution.place : preference === 'auto' ? undefined : preference;
  const explicit = preference !== 'auto';
  // The button's mark mirrors the picker's selection: the selected row's
  // place, else — Automatic with no row this surface can honour — this
  // surface itself, where the user is. Never the place the resolution
  // says the send NEEDS: a desktop app that is not installed is a row's
  // reason, not the button's face.
  const markPlace: ExecutionPlaceRole = selected ?? 'here';

  return (
    <Popover
      trigger="click"
      placement="bottomRight"
      open={popoverOpen}
      onOpenChange={setOpen}
      content={
        <div
          data-testid="execution-place-popover"
          style={{ minWidth: 280, maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          {onPick !== undefined && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {t('shared.executionPlace.picker.title')}
              </Text>
              <Radio.Group
                value={selected}
                onChange={(event) => {
                  const picked = roster.find((row) => row.role === event.target.value && row.available);
                  if (picked !== undefined) onPick(picked.role);
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
              >
                {roster.map((row) => (
                  <Radio
                    key={row.role}
                    value={row.role}
                    disabled={!row.available}
                    className="rules-settings-row oh-place-row"
                    data-testid="execution-place-option"
                    data-role={row.role}
                    data-available={row.available ? 'true' : 'false'}
                    style={{ fontSize: 12 }}
                  >
                    <PlaceMark place={row.role} size={13} />
                    <span data-testid="execution-place-option-label" style={{ whiteSpace: 'nowrap' }}>
                      {executionPlaceRosterLabel(row.role, t)}
                    </span>
                    {row.role === 'workspace-server' && resolution.serverName != null && (
                      <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                        {resolution.serverName}
                      </Text>
                    )}
                    {row.reason !== null && (
                      <span
                        data-testid="execution-place-option-reason"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          whiteSpace: 'nowrap',
                          marginInlineStart: 'auto',
                          paddingInlineStart: 16,
                        }}
                      >
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {executionPlaceRosterReason(row.reason, t)}
                        </Text>
                        {rowAction(row)}
                      </span>
                    )}
                  </Radio>
                ))}
              </Radio.Group>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginTop: 4 }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {copy.reason}
                  </Text>
                  {copy.knobs !== null && (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {copy.knobs}
                    </Text>
                  )}
                </div>
                {explicit && (
                  <Button
                    type="link"
                    size="small"
                    onClick={() => onPick(null)}
                    data-testid="execution-place-reset"
                    style={{ fontSize: 11, padding: 0, height: 'auto', whiteSpace: 'nowrap' }}
                  >
                    {t('shared.executionPlace.roster.reset')}
                  </Button>
                )}
              </div>
            </div>
          )}
          {onPick === undefined && (
            <>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {copy.reason}
              </Text>
              {copy.knobs !== null && (
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {copy.knobs}
                </Text>
              )}
              {resolution.cta !== null && <span data-testid="execution-place-cta">{ctaAction(resolution.cta)}</span>}
            </>
          )}
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
              <PlaceMark place={markPlace} size={13} />
            </span>
          </Button>
        </Tooltip>
      </span>
    </Popover>
  );
};

export default ExecutionPlaceControl;
