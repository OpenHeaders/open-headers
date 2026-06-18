/**
 * DebugModeDormantNotice — the "never-silent" footer chip (CDP Control Plane,
 * C3·S3). It speaks up for the one dormancy case no other surface shows: Debug
 * mode is ON, but the tab this surface acts on is OUTSIDE its scope, so a
 * realizable debug-tier rule's nav / worker / OOPIF reach is dormant on that
 * tab specifically. (Dynamic debug rules aren't realizable yet, so they don't
 * count — folded into `isFetchRealizableNow` upstream.)
 *
 * Surface-agnostic via `tabSource`: the panel resolves the inspected tab, the
 * popup / side panel the active tab. Master-off dormancy is signalled
 * elsewhere — the workbench rules-list badge, or (popup / side panel) the
 * visibly-off Debug mode toggle that sits right beside this chip — so this
 * chip stays silent while the master switch is off and covers only the per-tab
 * out-of-scope case.
 *
 * Never lying: the rule still runs over page xhr/fetch — only its extended
 * all-context reach is dormant here. Derived, never stored: in-scope is pure
 * roster membership read off the live `cdp` Status snapshot; the
 * realizable-rule existence is computed by the surface root and passed in.
 *
 * Capability-gated — nothing renders on hosts without `cdpInspection`.
 */

import { WarningOutlined } from '@ant-design/icons';
import { hasCapability } from '@openheaders/core/capabilities';
import { readCdpRoster } from '@openheaders/core/types';
import { useSettingValue } from '@openheaders/ui/workbench/settings/hooks';
import { Tooltip, theme } from 'antd';
import type React from 'react';
import { useStatus } from '../hooks/useStatus';
import { type DebugModeTabSource, useControlTabId } from './useControlTabId';

interface DebugModeDormantNoticeProps {
  /** Which tab the in-scope check resolves: inspected (panel) or active (popup). */
  tabSource: DebugModeTabSource;
  /** Whether any live debug-tier rule is realizable now (debug-tier + static). */
  hasRealizableRule: boolean;
}

export const DebugModeDormantNotice: React.FC<DebugModeDormantNoticeProps> = ({ tabSource, hasRealizableRule }) => {
  const { token } = theme.useToken();
  const { snapshot } = useStatus();
  const cdpEnabled = useSettingValue('inspection.cdpEnabled');
  const tabId = useControlTabId(tabSource);

  if (!hasCapability('cdpInspection')) return null;
  // Master-off dormancy is signalled elsewhere (see header). This chip covers
  // only the per-tab case, so it's silent unless Debug mode is on and a rule
  // it could extend actually exists.
  if (!cdpEnabled || !hasRealizableRule) return null;
  if (tabId == null) return null;

  const inScope = readCdpRoster(snapshot.cdp?.context).some((tab) => tab.tabId === tabId);
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
