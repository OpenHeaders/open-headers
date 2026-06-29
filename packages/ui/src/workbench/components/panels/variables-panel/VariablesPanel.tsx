/**
 * VariablesPanel — right-pane live view of variable scopes (surfaced to
 * users as "Scope"). Two modes, gated by the active tab's kind:
 *
 *   - "In Rule / Request / Template" — only variables referenced in the
 *     focused entity, resolved against every scope so the user sees the
 *     exact value that will hit DNR / the executor.
 *   - "All" — every scope's variables grouped by priority. The default,
 *     and the only option on tabs that don't reference variables.
 *
 * This file is the presentational container: it owns layout only and
 * reads everything else from `useVariablesPanel`. The model lives in the
 * sibling builders (`scope-context`, `live-registry`, `scope-resolver`,
 * `scope-variables`); the views are `ModeBar` / `InContextView` /
 * `AllScopesView`.
 */

import { PanelHeader, createPanelHeaderWiring } from '@openheaders/ui/shared/dock-layout';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import type React from 'react';
import { useMemo } from 'react';
import type { WorkbenchTab } from '../../../types';
import { AllScopesView } from './AllScopesView';
import { InContextView } from './InContextView';
import { ModeBar } from './ModeBar';
import { useVariablesPanel, type VariablesPanelHandlers } from './use-variables-panel';

interface VariablesPanelProps extends VariablesPanelHandlers {
  /** Title-bar `(i)` popover copy. */
  info: InfoPopoverContent;
  onClose: () => void;
  /** Active tab so the panel can compute "in context" variables. */
  activeTab: WorkbenchTab | null;
}

const VariablesPanel: React.FC<VariablesPanelProps> = (props) => {
  const { info, onClose, activeTab } = props;
  const headerWiring = useMemo(() => createPanelHeaderWiring({ onHide: onClose }), [onClose]);
  const vm = useVariablesPanel(activeTab, props);

  return (
    <div
      className="rules-right-panel rules-right-panel--variables"
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      <PanelHeader wiring={headerWiring} title={<strong>Scope</strong>} info={info} />

      <div style={{ padding: '8px 12px', flex: 1, overflowY: 'auto' }}>
        <ModeBar
          mode={vm.mode}
          setMode={vm.setMode}
          scopeKind={vm.scopeKind}
          contextLabel={vm.contextLabel}
          contextEntityName={vm.contextEntityName}
        />

        {vm.mode === 'in-context' && vm.scopeKind !== 'none' ? (
          <InContextView
            vars={vm.inContextVars}
            errors={vm.inContextErrors}
            scopeKind={vm.scopeKind}
            hasContext={vm.hasContextEntity}
            openVariableEditor={vm.openVariableEditor}
          />
        ) : (
          <AllScopesView
            allVars={vm.allVars}
            activeEnvironmentName={vm.activeEnvironmentName}
            defaultEnvironmentName={vm.defaultEnvironmentName}
            activeCollectionName={vm.activeCollectionName}
            openScopeEditor={vm.openScopeEditor}
          />
        )}
      </div>
    </div>
  );
};

export default VariablesPanel;
