/**
 * WorkspaceOrgBadge — the per-workspace "where does this live?" badge
 * (U3.5, UNIFIED_ORACLE_MODEL.md §6.2). Resolves a workspace's `orgId`
 * to a scope tag: icon + colour + label per Org.
 *
 * Always visible — §6.2 calls for the org-binding affordance to be a
 * permanent fixture, not something that appears only once a second Org
 * exists. With one Org seeded it simply reads "On this device".
 *
 * Purely presentational: the interaction (opening the sync-scope
 * picker) is owned by {@link WorkspaceSyncScopePicker}, which wraps this
 * badge as its trigger.
 */

import { type OrgDescriptor, orgIdentityLabel } from '@openheaders/core/identity';
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
}

export const WorkspaceOrgBadge: React.FC<WorkspaceOrgBadgeProps> = ({ descriptor, compact }) => {
  const reach = useBackendReach();
  const mode = useBackendMode();
  if (!descriptor) return null;

  const visual = orgScopeVisual(descriptor, { mode, reach });
  const label = orgIdentityLabel(descriptor);

  return (
    <Tooltip title={visual.description} placement="top" mouseEnterDelay={0.4}>
      <Tag
        color={visual.tagColor}
        icon={<OrgIcon descriptor={descriptor} size={compact ? 11 : 12} />}
        style={{
          margin: 0,
          fontSize: compact ? 10 : 11,
          lineHeight: compact ? '16px' : '18px',
          paddingInline: compact ? 4 : 6,
          userSelect: 'none',
        }}
      >
        {label}
      </Tag>
    </Tooltip>
  );
};
