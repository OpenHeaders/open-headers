/**
 * DebugModeDormantNotice — the panel's "never-silent" footer chip (CDP
 * Control Plane, C3·S3). It speaks up for the one dormancy case no other
 * surface shows: Debug mode is ON, but the inspected tab is OUTSIDE its
 * scope, so a realizable debug-tier rule's nav / worker / OOPIF reach is
 * dormant on this tab specifically. (The global "Debug mode off" case is
 * the rules-list badge's job; dynamic debug rules aren't realizable yet, so
 * they don't count — both folded into `isFetchRealizableNow` upstream.)
 *
 * Never lying: the rule still runs over page xhr/fetch — only its extended
 * all-context reach is dormant here. Derived, never stored: in-scope is pure
 * roster membership read off the live `cdp` Status snapshot; the
 * realizable-rule existence is computed by the panel root and passed in.
 *
 * Capability-gated — nothing renders on hosts without `cdpInspection`.
 */

import { WarningOutlined } from '@ant-design/icons';
import { hasCapability } from '@openheaders/core/capabilities';
import { hostNavigation } from '@openheaders/core/navigation';
import { readCdpRoster } from '@openheaders/core/types';
import { useStatus } from '@openheaders/ui/shared/hooks/useStatus';
import { useSettingValue } from '@openheaders/ui/workbench/settings/hooks';
import { Tooltip, theme } from 'antd';
import type React from 'react';

interface DebugModeDormantNoticeProps {
  /** Whether any live debug-tier rule is realizable now (debug-tier + static). */
  hasRealizableRule: boolean;
}

export const DebugModeDormantNotice: React.FC<DebugModeDormantNoticeProps> = ({ hasRealizableRule }) => {
  const { token } = theme.useToken();
  const { snapshot } = useStatus();
  const cdpEnabled = useSettingValue('inspection.cdpEnabled');

  if (!hasCapability('cdpInspection')) return null;
  // Master-off dormancy is global — the rules-list badge owns it. This chip
  // covers only the per-tab case, so it's silent unless Debug mode is on and
  // a rule it could extend actually exists.
  if (!cdpEnabled || !hasRealizableRule) return null;

  const inspectedTabId = hostNavigation.inspectedTabId();
  if (inspectedTabId == null) return null;

  const inScope = readCdpRoster(snapshot.cdp?.context).some((tab) => tab.tabId === inspectedTabId);
  if (inScope) return null;

  return (
    <Tooltip
      placement="top"
      title="Debug mode is on, but this tab is outside its scope — your debug-tier rules' nav / worker / OOPIF effects are dormant here. Bring it into scope from Debug mode (change the scope or pin this tab). They still run over page requests (xhr/fetch)."
    >
      <span
        className="rules-statusbar-item"
        style={{ color: token.colorWarning, display: 'inline-flex', alignItems: 'center', gap: 4 }}
      >
        <WarningOutlined style={{ fontSize: 11 }} />
        Tab out of scope
      </span>
    </Tooltip>
  );
};

export default DebugModeDormantNotice;
