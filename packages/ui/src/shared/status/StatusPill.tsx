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
import { useStatus } from '../hooks/useStatus';
import { Button, Popover, Tag, Tooltip, Typography, theme } from 'antd';
import type { TooltipPlacement } from 'antd/es/tooltip';
import React from 'react';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { getBuildInfo } from '@openheaders/ui/shared/build-info';
import { type StatusLevel, type StatusSnapshot, type StatusSubsystem, SUBSYSTEM_LABELS } from './types';

// `cdp` (labeled "Debug mode") is mirrored here as a read-only status row, so
// its on/off state and faults (e.g. a banner-cancel fall-back) surface
// alongside every other subsystem and feed the worst-state summary. The
// interactive controls live in the standalone Debug mode pill (see
// `shared/debug-mode/DebugModePill`); this row is status only.
export const SUBSYSTEM_ORDER: StatusSubsystem[] = [
  'sync',
  'activity',
  'rules',
  'requests',
  'cdp',
  'permissions',
  'secrets',
  'live',
];

/**
 * Fixed tag width shared by every row in the Status popover —
 * built-in subsystems AND product-level extras. Sized to fit the
 * longest label ("Permissions") at `fontSize: 10`
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
export const STATUS_DOCS_SECTION_ID = 'system-status';

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
   * Render an optional action INSIDE a subsystem's own popover row,
   * right-aligned after its message — for remedies that belong to the
   * row itself (e.g. the secrets row's "Relaunch app"). Keep the node
   * text-sized: the row is an 11px single-liner. Return `null` (or omit
   * the prop) when the row needs no action.
   */
  renderSubsystemInlineAction?: (
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
  renderSubsystemInlineAction,
  onOpenDocs,
  label,
}) => {
  const t = useT();
  const { token } = theme.useToken();
  const { snapshot, worst } = useStatus();
  // In `row` density each subsystem pill carries its own hover tooltip
  // while the whole row triggers the click popover — suppress the
  // tooltips while the popover is open so the two never overlap.
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const hasEntries = Object.values(snapshot).some(Boolean);
  const color = worst === 'red' ? token.colorError : worst === 'yellow' ? token.colorWarning : token.colorSuccess;
  const summary = buildSummary(t, snapshot, worst);
  const ariaLabel = t('shared.chrome.status.aria', { summary });

  const body = (
    <StatusPopoverBody
      snapshot={snapshot}
      token={token}
      renderSubsystemExtras={renderSubsystemExtras}
      renderSubsystemInlineAction={renderSubsystemInlineAction}
    />
  );
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
          {t('shared.chrome.status.title')}
        </Typography.Text>
      </div>
      {onOpenDocs && (
        <Tooltip title={t('shared.chrome.status.aboutTooltip')}>
          <Button
            type="text"
            size="small"
            icon={<InfoCircleOutlined style={{ fontSize: 12 }} />}
            onClick={() => onOpenDocs(STATUS_DOCS_SECTION_ID)}
            aria-label={t('shared.chrome.status.openDocsAria')}
            style={{ padding: '0 4px', height: 20, minWidth: 'auto' }}
          />
        </Tooltip>
      )}
    </div>
  );

  const effectivePlacement = placement ?? DEFAULT_PLACEMENT[density];

  if (density === 'row') {
    return (
      <Popover
        placement={effectivePlacement}
        trigger={['click']}
        content={body}
        title={titleNode}
        onOpenChange={setPopoverOpen}
      >
        <span
          className={className ?? 'rules-statusbar-item'}
          role="status"
          aria-label={ariaLabel}
          style={{ cursor: hasEntries ? 'pointer' : 'default', display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          {SUBSYSTEM_ORDER.map((sub) => (
            <SubsystemPill key={sub} subsystem={sub} snapshot={snapshot} token={token} suppressTooltip={popoverOpen} />
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

function buildSummary(t: Translate, snapshot: StatusSnapshot, worst: StatusLevel): string {
  if (worst === 'green') {
    return t('shared.chrome.status.healthy');
  }
  for (const sub of SUBSYSTEM_ORDER) {
    const entry = snapshot[sub];
    if (entry?.state === worst) {
      return `${t(SUBSYSTEM_LABELS[sub])}: ${truncate(entry.message, 50)}`;
    }
  }
  return worst === 'red' ? t('shared.chrome.status.failure') : t('shared.chrome.status.issues');
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

interface SubsystemPillProps {
  subsystem: StatusSubsystem;
  snapshot: StatusSnapshot;
  token: ReturnType<typeof theme.useToken>['token'];
  /** Force-close the pill's tooltip while the shared popover is open. */
  suppressTooltip?: boolean;
}

/**
 * One pill in the five-pill row. Color reflects the subsystem's own
 * state (green / yellow / red / grey when no entry has been recorded).
 * The whole row shares one Popover — this component renders only the
 * label + dot, and a per-subsystem tooltip with the latest message.
 */
const SubsystemPill: React.FC<SubsystemPillProps> = ({ subsystem, snapshot, token, suppressTooltip }) => {
  const t = useT();
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
  const tipBody = entry?.message ?? t('shared.chrome.status.noEvents');
  return (
    <Tooltip title={tipBody} placement="top" open={suppressTooltip ? false : undefined}>
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
        {t(SUBSYSTEM_LABELS[subsystem])}
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
  renderSubsystemInlineAction?: (
    subsystem: StatusSubsystem,
    entry: StatusSnapshot[StatusSubsystem] | undefined,
  ) => React.ReactNode;
}

/**
 * One popover row with a grey hover wash. State-driven hover (not CSS)
 * — the shared pill renders under several host stylesheets, so a class
 * would need per-host wiring; the token keeps the wash theme-correct.
 * Negative horizontal margin lets the wash bleed to the popover edge
 * while the content keeps its column alignment.
 */
const SubsystemRow: React.FC<{
  token: ReturnType<typeof theme.useToken>['token'];
  children: React.ReactNode;
}> = ({ token, children }) => {
  const [hovered, setHovered] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '2px 6px',
        margin: '0 -6px',
        borderRadius: token.borderRadiusSM,
        background: hovered ? token.colorFillTertiary : 'transparent',
      }}
    >
      {children}
    </div>
  );
};

const StatusPopoverBody: React.FC<StatusPopoverBodyProps> = ({
  snapshot,
  token,
  renderSubsystemExtras,
  renderSubsystemInlineAction,
}) => {
  const t = useT();
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
        const inlineAction = renderSubsystemInlineAction?.(sub, entry);
        return (
          // Status is a snapshot — "right now" by design. Timestamps
          // would answer "when did this state last change", which is
          // history-shaped info that belongs in the observability log
          // (Settings → Export Diagnostic Log). Keeping the popover a
          // pure state surface keeps each row single-line + the five-
          // row block visually tight.
          <SubsystemRow key={sub} token={token}>
            <Tag color={color} style={{ fontSize: 10, width: STATUS_TAG_WIDTH, textAlign: 'center', margin: 0 }}>
              {t(SUBSYSTEM_LABELS[sub])}
            </Tag>
            <Typography.Text style={{ fontSize: 11, flex: 1, color: token.colorText }}>
              {entry?.message ?? t('shared.chrome.status.noEvents')}
            </Typography.Text>
            {inlineAction}
          </SubsystemRow>
        );
      })}
      {extrasRows.length > 0 ? extrasRows : null}
      <BuildInfoFooter token={token} />
    </div>
  );
};

/**
 * Compact build-info line rendered at the bottom of the Status popover.
 * Replaces the standalone version chip that used to live in the popup
 * footer — keeps Open Headers' identity visible while reclaiming the
 * footer's pixel budget on small surfaces.
 */
const BuildInfoFooter: React.FC<{ token: ReturnType<typeof theme.useToken>['token'] }> = ({ token }) => {
  const t = useT();
  const info = getBuildInfo();
  const label =
    info.channel === 'beta' ? t('shared.chrome.status.versionBeta', { version: info.version }) : info.version;
  const buildDetail = info.build > 0 ? ` · ${t('shared.chrome.status.buildNumber', { build: info.build })}` : '';
  const commitDetail = info.commit && info.commit !== '—' ? ` · ${info.commit}` : '';
  return (
    <div
      style={{
        marginTop: 4,
        paddingTop: 6,
        borderTop: `1px solid ${token.colorBorderSecondary}`,
        fontSize: 10,
        color: token.colorTextTertiary,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {t('shared.chrome.status.buildLine', { version: label })}
      {buildDetail}
      {commitDetail}
    </div>
  );
};
