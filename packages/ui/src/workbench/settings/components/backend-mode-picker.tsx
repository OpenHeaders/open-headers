import { theme } from 'antd';
import type React from 'react';
import type { Host } from '../../../shared/host-vocabulary';
import type { BackendMode } from '../schema/backend';
import { backendModeIsPending } from '../schema/backend';
import { BackendIcon } from './backend-icons';
import type { ScenarioDescriptor } from './backend-scenarios';

interface ModePickerProps {
  scenarios: readonly ScenarioDescriptor[];
  /** The mode the tile row is previewing right now (purely visual). */
  previewMode: BackendMode;
  /** The mode that's actually persisted to `backend.mode` (the system setting). */
  activeMode: BackendMode;
  /**
   * The mode whose back-end is currently confirmed live (SW running
   * for `in-browser`, WS green for others). `null` while connecting
   * or when sync is disabled.
   */
  liveMode: BackendMode | null;
  /** Current host — drives per-tile validity (extension can pick any;
   *  desktop / web can't host an in-browser back-end). */
  host: Host;
  /** Tile click — updates the local preview only, not the setting. */
  onPreview: (next: BackendMode) => void;
}

export const ModePicker: React.FC<ModePickerProps> = ({
  scenarios,
  previewMode,
  activeMode,
  liveMode,
  host,
  onPreview,
}) => (
  <div
    role="radiogroup"
    aria-label="Backend mode preview"
    style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${Math.min(scenarios.length, 4)}, minmax(0, 1fr))`,
      gap: 8,
      marginBottom: 14,
    }}
  >
    {scenarios.map((s) => (
      <PickerButton
        key={s.mode}
        descriptor={s}
        /** "Previewing this tile" — primary border + tint. */
        preview={previewMode === s.mode}
        /** This is the active back-end (independent of preview). */
        active={activeMode === s.mode}
        /** Active AND its connection is live. */
        live={liveMode === s.mode}
        /** Selectable on this host — controls visual dim, NOT click.
         *  The tile is always previewable so users can read about
         *  modes their host can't run; downstream UI (Apply, Test,
         *  config inputs) handles the actual gating. */
        validForHost={s.validHosts.includes(host)}
        onSelect={() => onPreview(s.mode)}
      />
    ))}
  </div>
);

const PickerButton: React.FC<{
  descriptor: ScenarioDescriptor;
  /** Currently being previewed by the user (purely visual). */
  preview: boolean;
  /** Currently the active system back-end. Drives the ACTIVE chip together with `live`. */
  active: boolean;
  /** Back-end for this mode is actually connected. */
  live: boolean;
  /** Whether this tile can be SWITCHED INTO on this host. Click still
   *  previews (so users can read about modes their host can't run);
   *  visual dim + tooltip communicate that switching is gated downstream. */
  validForHost: boolean;
  onSelect: () => void;
}> = ({ descriptor, preview, active, live, validForHost, onSelect }) => {
  const { token } = theme.useToken();
  const pending = backendModeIsPending(descriptor.mode);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={preview}
      title={
        validForHost
          ? undefined
          : "Can't switch to this back-end from this host. Click to preview the docs anyway."
      }
      onClick={onSelect}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px 8px 10px',
        borderRadius: 8,
        background: preview ? token.colorPrimaryBg : token.colorBgContainer,
        border: `1px solid ${preview ? token.colorPrimary : token.colorBorderSecondary}`,
        cursor: 'pointer',
        opacity: validForHost ? 1 : 0.55,
        transition: 'border-color 120ms, background 120ms, opacity 120ms',
        fontFamily: 'inherit',
        color: token.colorText,
        textAlign: 'left',
        // Anchor for the absolute-positioned status chip; keeps the
        // chip out of the title's flex track so "Desktop App" /
        // "Remote / WAN" stay on one line.
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          flex: 'none',
          width: 30,
          height: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          filter: preview ? 'none' : 'grayscale(0.7) opacity(0.7)',
          transition: 'filter 120ms',
        }}
      >
        <BackendIcon kind={descriptor.icon} size={28} />
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 12.5,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {descriptor.title}
      </div>
      <CornerTag active={active} live={live} pending={pending} />
    </button>
  );
};

/**
 * Status tag overlay on a picker tile. Absolute-positioned at the
 * top-right so it doesn't compete with the title text for flex space —
 * "Desktop App" / "Remote / WAN" stay on one line.
 *
 * "ACTIVE" (green) only when the back-end for THIS mode is the active
 * one AND its connection is live; "SELECTED" (primary) when active but
 * still connecting; "SOON" marks not-yet-shipped scenarios.
 */
const CornerTag: React.FC<{
  /** This mode is the persisted system back-end. */
  active: boolean;
  /** The active back-end is actually connected. Pairs with `active`. */
  live: boolean;
  pending: boolean;
}> = ({ active, live, pending }) => {
  const { token } = theme.useToken();
  const tags: Array<{ label: string; bg: string; color: string; border: string }> = [];
  if (active && live) {
    // Configured AND connected — the strong "this is serving you right now" signal.
    tags.push({
      label: 'Active',
      bg: token.colorSuccess,
      color: token.colorTextLightSolid,
      border: token.colorSuccess,
    });
  } else if (active) {
    // Configured but not yet live — useful while the WS is connecting.
    tags.push({
      label: 'Selected',
      bg: token.colorPrimary,
      color: token.colorTextLightSolid,
      border: token.colorPrimary,
    });
  }
  if (pending) {
    tags.push({
      label: 'Soon',
      bg: token.colorWarningBg,
      color: token.colorWarningText,
      border: token.colorWarningBorder,
    });
  }
  if (tags.length === 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        top: 4,
        right: 4,
        display: 'inline-flex',
        gap: 4,
        pointerEvents: 'none',
      }}
    >
      {tags.map((t) => (
        <span
          key={t.label}
          style={{
            padding: '0 4px',
            fontSize: 7.5,
            fontWeight: 700,
            letterSpacing: 0.2,
            textTransform: 'uppercase',
            borderRadius: 999,
            background: t.bg,
            color: t.color,
            border: `1px solid ${t.border}`,
            lineHeight: '11px',
          }}
        >
          {t.label}
        </span>
      ))}
    </div>
  );
};
