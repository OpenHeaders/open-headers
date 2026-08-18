/**
 * WorkspaceOrgBadge — the per-workspace "where does this live?" badge
 * (U3.5, the unified-oracle model §6.2). Resolves a workspace's `orgId`
 * to a scope tag: icon + colour + label per Org.
 *
 * Always visible — §6.2 calls for the org-binding affordance to be a
 * permanent fixture, not something that appears only once a second Org
 * exists. With one Org seeded it simply reads "On this device".
 *
 * Purely presentational. A workspace's Org binding is set at create
 * time and never changes (the Session-47 collapse — Duplicate-into
 * replaces re-home), so this badge has no edit affordance attached.
 */

import { type OrgDescriptor, orgIdentityLabel } from '@openheaders/core/identity';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Tag, Tooltip } from 'antd';
import type React from 'react';
import { useBackendMode } from '../hooks/useBackendMode';
import { useBackendReach } from '../hooks/useBackendReach';
import { OrgIcon } from './OrgIcon';
import { orgScopeVisual } from './org-scope-vocabulary';

export interface WorkspaceOrgBadgeProps {
  /** Resolved Org for the workspace; `null` during the pre-bootstrap window. */
  descriptor: OrgDescriptor | null;
  /** Compact variant for dense list rows. */
  compact?: boolean;
  /**
   * Force-hide the hover tooltip. Hosts that mount the badge inside a
   * click-to-open trigger (workspace switcher / pill) pass their
   * surface's open state here — otherwise the tooltip lingers over the
   * opened dropdown, because the pointer never leaves the badge and no
   * mouseout ever fires.
   */
  suppressTooltip?: boolean;
}

export const WorkspaceOrgBadge: React.FC<WorkspaceOrgBadgeProps> = ({ descriptor, compact, suppressTooltip }) => {
  // The scope description reads the host's OWN bind tier (self) — how
  // far this host's server reaches, not a joined backend's tier.
  const { self: reach } = useBackendReach();
  const mode = useBackendMode();
  const t = useT();
  if (!descriptor) return null;

  const visual = orgScopeVisual(t, descriptor, { mode, reach });
  const label = orgIdentityLabel(descriptor);

  return (
    <Tooltip
      title={
        <>
          <div style={{ fontWeight: 600 }}>{label}</div>
          <div>{visual.description}</div>
        </>
      }
      placement="top"
      mouseEnterDelay={0.4}
      open={suppressTooltip ? false : undefined}
    >
      <Tag
        color={visual.tagColor}
        icon={<OrgIcon descriptor={descriptor} size={compact ? 11 : 12} />}
        style={{
          margin: 0,
          fontSize: compact ? 10 : 11,
          lineHeight: compact ? '16px' : '18px',
          paddingInline: compact ? 4 : 6,
          userSelect: 'none',
          // Let the host (flex parent) decide the cap; this badge must
          // be willing to shrink and ellipsize so long device names
          // (e.g. "Engineering-Team-MacBook-Pro") don't push siblings
          // off-screen on the sidepanel.
          display: 'inline-flex',
          alignItems: 'center',
          // OrgIcon isn't an `.anticon`, so antd's built-in icon→label
          // margin never applies — the flex gap provides the breathing
          // room between the glyph and the Org name.
          columnGap: compact ? 3 : 4,
          maxWidth: '100%',
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
          }}
        >
          {label}
        </span>
      </Tag>
    </Tooltip>
  );
};
