/**
 * StatusPill — the single status indicator shown across every surface
 * (workspace footer, popup/sidepanel header). One component keeps the
 * popover body + color semantics identical across surfaces, so the user
 * sees the same truth wherever the extension is open.
 *
 * Three densities:
 *   - `row`     (default workspace footer): five always-visible pills,
 *     one per subsystem — `sync` / `rules` / `requests` / `permissions`
 *     / `secrets`. Each pill carries its label + a colored dot; the
 *     color reflects that subsystem's current state (green / yellow /
 *     red / grey-for-no-data). Clicking any pill opens the shared
 *     popover with the per-subsystem message list. Gives users a
 *     bird's-eye view now that every subsystem actively reports.
 *   - `full`    (legacy compact): dot + worst-state summary label.
 *     Kept for surfaces that can't fit the five-pill row but still
 *     want a text label (none today — available for future use).
 *   - `compact` (popup/sidepanel header): dot only, label moves to
 *     the tooltip. Zero width impact when healthy — the popup header
 *     is crowded, so the indicator has to stay out of the way unless
 *     something actually needs attention.
 */

import { InfoCircleOutlined } from '@ant-design/icons';
import { Button, Popover, Tag, Tooltip, Typography, theme } from 'antd';
import type { TooltipPlacement } from 'antd/es/tooltip';
import React from 'react';
import { useStatus } from '@/hooks/useStatus';
import { type StatusLevel, type StatusSnapshot, type StatusSubsystem, SUBSYSTEM_LABELS } from './types';

export const SUBSYSTEM_ORDER: StatusSubsystem[] = ['sync', 'rules', 'requests', 'permissions', 'secrets', 'live'];

/**
 * Fixed tag width shared by every row in the Status popover —
 * built-in subsystems AND product-level extras. Sized to fit the
 * longest label ("Permissions" / "Desktop App") at `fontSize: 10`
 * with Ant's default horizontal padding, so right-side messages
 * align to the same x-offset across the whole panel.
 */
export const STATUS_TAG_WIDTH = 92;

/**
 * Docs anchor for the "System Status" reference section. Surfaces
 * that mount the `StatusPill` pass this id through the `openDocs`
 * hook (workspace) or the `#/docs/...` hash route (popup/sidepanel)
 * when the user clicks the popover's (i) button.
 */
export const STATUS_DOCS_SECTION_ID = 'doc-system-status';

export type StatusPillDensity = 'row' | 'full' | 'compact';

export interface StatusPillProps {
  density?: StatusPillDensity;
  /** Extra class to forward to the outer span — lets the workspace
   *  footer keep its `rules-statusbar-item` hit target styling. */
  className?: string;
  /**
   * Override the popover placement. Density-specific defaults:
   *   - `row`     → `top`    (workspace footer; opens upward)
   *   - `full`    → `top`    (legacy compact; opens upward)
   *   - `compact` → `bottom` (popup header; opens downward)
   *
   * The sidepanel surface is narrower than the popup, so the default
   * `bottom`/`right`-centered popover can clip against the sidepanel's
   * right edge. Callers there pass `right` / `bottomLeft` to flip the
   * opening direction.
   */
  placement?: TooltipPlacement;
  /**
   * Render optional product-specific content inside a subsystem's row
   * in the popover — below its message + timestamp. Keeps the
   * `StatusPill` component generic (no hard-coded install CTAs or
   * product copy) while letting consuming surfaces attach call-to-
   * action buttons where they semantically belong. Return `null` (or
   * omit the prop) when nothing extra should render.
   */
  renderSubsystemExtras?: (
    subsystem: StatusSubsystem,
    entry: StatusSnapshot[StatusSubsystem] | undefined,
  ) => React.ReactNode;
  /**
   * If provided, the popover title shows an (i) button that calls this
   * with `STATUS_DOCS_SECTION_ID`. Surfaces that have a docs panel
   * (workspace) wire it to `useInspectorNav().openDocs`; surfaces that
   * don't (popup / sidepanel) open `workbench.html#/docs/<id>` in a
   * new tab. Omit the prop to hide the (i) button entirely.
   */
  onOpenDocs?: (sectionId: string) => void;
  /**
   * Override the auto-generated summary text in `full` density. Surfaces
   * that want a static caption (e.g. "System status") pass this instead
   * of letting the worst-state summary bleed into the surrounding
   * footer.
   */
  label?: React.ReactNode;
}

const DEFAULT_PLACEMENT: Record<StatusPillDensity, TooltipPlacement> = {
  row: 'top',
  full: 'top',
  compact: 'bottom',
};

export const StatusPill: React.FC<StatusPillProps> = ({
  density = 'row',
  className,
  placement,
  renderSubsystemExtras,
  onOpenDocs,
  label,
}) => {
  const { token } = theme.useToken();
  const { snapshot, worst } = useStatus();
  const hasEntries = Object.values(snapshot).some(Boolean);
  const color = worst === 'red' ? token.colorError : worst === 'yellow' ? token.colorWarning : token.colorSuccess;
  const summary = buildSummary(snapshot, worst);
  const ariaLabel = `System status: ${summary}`;

  const body = <StatusPopoverBody snapshot={snapshot} token={token} renderSubsystemExtras={renderSubsystemExtras} />;
  // Flex + align-items: center keeps the dot vertically centered on
  // the "System status" cap height (Space doesn't cross-align inline
  // children by default). The left group (dot + label) pins flush to
  // the header's left edge; when `onOpenDocs` is provided, a small
  // (i) button is right-aligned via `justify-content: space-between`
  // so the label column still lines up with the tag column below.
  const titleNode = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: color,
          }}
        />
        <Typography.Text strong style={{ fontSize: 12 }}>
          System status
        </Typography.Text>
      </div>
      {onOpenDocs && (
        <Tooltip title="About this panel">
          <Button
            type="text"
            size="small"
            icon={<InfoCircleOutlined style={{ fontSize: 12 }} />}
            onClick={() => onOpenDocs(STATUS_DOCS_SECTION_ID)}
            aria-label="Open system status documentation"
            style={{ padding: '0 4px', height: 20, minWidth: 'auto' }}
          />
        </Tooltip>
      )}
    </div>
  );

  const effectivePlacement = placement ?? DEFAULT_PLACEMENT[density];

  if (density === 'row') {
    return (
      <Popover placement={effectivePlacement} trigger={['click']} content={body} title={titleNode}>
        <span
          className={className ?? 'rules-statusbar-item'}
          role="status"
          aria-label={ariaLabel}
          style={{ cursor: hasEntries ? 'pointer' : 'default', display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          {SUBSYSTEM_ORDER.map((sub) => (
            <SubsystemPill key={sub} subsystem={sub} snapshot={snapshot} token={token} />
          ))}
        </span>
      </Popover>
    );
  }

  if (density === 'compact') {
    return (
      <Popover placement={effectivePlacement} trigger={['click', 'hover']} content={body} title={titleNode}>
        <span
          className={className}
          role="status"
          aria-label={ariaLabel}
          style={{
            cursor: hasEntries ? 'pointer' : 'default',
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: color,
            }}
          />
        </span>
      </Popover>
    );
  }

  return (
    <Popover placement={effectivePlacement} trigger={['click', 'hover']} content={body} title={titleNode}>
      <span
        className={className ?? 'rules-statusbar-item'}
        role="status"
        style={{ cursor: hasEntries ? 'pointer' : 'default' }}
        aria-label={ariaLabel}
      >
        <span className="rules-dot" style={{ background: color }} />
        {label ?? summary}
      </span>
    </Popover>
  );
};

function buildSummary(snapshot: StatusSnapshot, worst: StatusLevel): string {
  if (worst === 'green') {
    return 'Healthy';
  }
  for (const sub of SUBSYSTEM_ORDER) {
    const entry = snapshot[sub];
    if (entry?.state === worst) {
      return `${SUBSYSTEM_LABELS[sub]}: ${truncate(entry.message, 50)}`;
    }
  }
  return worst === 'red' ? 'Failure' : 'Issues';
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

interface SubsystemPillProps {
  subsystem: StatusSubsystem;
  snapshot: StatusSnapshot;
  token: ReturnType<typeof theme.useToken>['token'];
}

/**
 * One pill in the five-pill row. Color reflects the subsystem's own
 * state (green / yellow / red / grey when no entry has been recorded).
 * The whole row shares one Popover — this component renders only the
 * label + dot, and a per-subsystem tooltip with the latest message.
 */
const SubsystemPill: React.FC<SubsystemPillProps> = ({ subsystem, snapshot, token }) => {
  const entry = snapshot[subsystem];
  const state: StatusLevel | null = entry?.state ?? null;
  const dotColor =
    state === 'red'
      ? token.colorError
      : state === 'yellow'
        ? token.colorWarning
        : state === 'green'
          ? token.colorSuccess
          : token.colorTextTertiary;
  const tipBody = entry?.message ?? 'No events yet';
  return (
    <Tooltip title={tipBody} placement="top">
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 11,
          color: token.colorTextSecondary,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: dotColor,
          }}
        />
        {SUBSYSTEM_LABELS[subsystem]}
      </span>
    </Tooltip>
  );
};

interface StatusPopoverBodyProps {
  snapshot: StatusSnapshot;
  token: ReturnType<typeof theme.useToken>['token'];
  renderSubsystemExtras?: (
    subsystem: StatusSubsystem,
    entry: StatusSnapshot[StatusSubsystem] | undefined,
  ) => React.ReactNode;
}

const StatusPopoverBody: React.FC<StatusPopoverBodyProps> = ({ snapshot, token, renderSubsystemExtras }) => {
  // Collect extras first (same iteration order as the standard rows)
  // so the block of product callouts is stable across renders and
  // always sits BELOW every built-in subsystem row. Prevents a sync
  // callout from visually splitting the standard five-row block.
  const extrasRows = renderSubsystemExtras
    ? SUBSYSTEM_ORDER.map((sub) => {
        const node = renderSubsystemExtras(sub, snapshot[sub]);
        return node ? <React.Fragment key={`extras-${sub}`}>{node}</React.Fragment> : null;
      }).filter((n): n is React.ReactElement => n !== null)
    : [];

  // Reorder the subsystem rows so static-info (no entry yet) rows
  // come before state-carrying (has an entry, green/yellow/red) rows.
  // Within each partition the canonical SUBSYSTEM_ORDER is preserved
  // so rows don't shuffle laterally — they only migrate once, on the
  // first report for their subsystem. Keeps the informational block
  // and the dynamic-state block visually grouped.
  const greys: StatusSubsystem[] = SUBSYSTEM_ORDER.filter((sub) => !snapshot[sub]);
  const coloreds: StatusSubsystem[] = SUBSYSTEM_ORDER.filter((sub) => !!snapshot[sub]);
  const orderedSubsystems: StatusSubsystem[] = [...greys, ...coloreds];

  return (
    <div style={{ maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {orderedSubsystems.map((sub) => {
        const entry = snapshot[sub];
        const state: StatusLevel = entry?.state ?? 'green';
        const color = state === 'red' ? 'error' : state === 'yellow' ? 'warning' : entry ? 'success' : 'default';
        return (
          // Status is a snapshot — "right now" by design. Timestamps
          // would answer "when did this state last change", which is
          // history-shaped info that belongs in the observability log
          // (Settings → Export Diagnostic Log). Keeping the popover a
          // pure state surface keeps each row single-line + the five-
          // row block visually tight.
          <div key={sub} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Tag color={color} style={{ fontSize: 10, width: STATUS_TAG_WIDTH, textAlign: 'center', margin: 0 }}>
              {SUBSYSTEM_LABELS[sub]}
            </Tag>
            <Typography.Text style={{ fontSize: 11, flex: 1, color: token.colorText }}>
              {entry?.message ?? 'No events yet'}
            </Typography.Text>
          </div>
        );
      })}
      {extrasRows.length > 0 ? extrasRows : null}
    </div>
  );
};
