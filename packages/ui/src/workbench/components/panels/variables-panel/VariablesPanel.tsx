/**
 * VariablesPanel — right-pane live view of variable scopes (surfaced to
 * users as "Scope"). One scrolling panel with two collapsible sections:
 *
 *   - "In ‹rule/request/template›" — the variables the focused entity
 *     references, resolved against every scope so the user sees the exact
 *     value that will hit DNR / the executor. A hint stands in when no
 *     variable-referencing tab is focused.
 *   - "All scopes" — every scope's variables grouped by priority.
 *
 * This file is the presentational container: it owns layout only and
 * reads everything else from `useVariablesPanel`. The model lives in the
 * sibling builders (`scope-context`, `live-registry`, `scope-resolver`,
 * `scope-variables`); the views are `InContextView` / `AllScopesView`,
 * wrapped in the collapsible `PanelSection`.
 */

import { PanelHeader, createPanelHeaderWiring } from '@openheaders/ui/shared/dock-layout';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import type React from 'react';
import { useMemo } from 'react';
import type { WorkbenchTab } from '../../../types';
import { AllScopesView } from './AllScopesView';
import { InContextView } from './InContextView';
import { PanelSection } from './PanelSection';
import { ALL_SCOPES_INFO, IN_CONTEXT_INFO } from './scope-info';
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

  const noun = vm.scopeKind === 'request' ? 'request' : vm.scopeKind === 'template' ? 'template' : 'rule';
  const inContextTitle = vm.contextEntityName ? `In ${noun}: ${vm.contextEntityName}` : 'In context';

  return (
    <div
      className="rules-right-panel rules-right-panel--variables"
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      <PanelHeader wiring={headerWiring} title={<strong>Scope</strong>} info={info} />

      <div style={{ padding: '0 12px', flex: 1, overflowY: 'auto' }}>
        <PanelSection title={inContextTitle} info={IN_CONTEXT_INFO}>
          <InContextView
            vars={vm.inContextVars}
            errors={vm.inContextErrors}
            scopeKind={vm.scopeKind}
            hasContext={vm.hasContextEntity}
            openVariableEditor={vm.openVariableEditor}
          />
        </PanelSection>

        <PanelSection title="All scopes" info={ALL_SCOPES_INFO} isLast>
          <AllScopesView
            allVars={vm.allVars}
            activeEnvironmentName={vm.activeEnvironmentName}
            defaultEnvironmentName={vm.defaultEnvironmentName}
            activeCollectionName={vm.activeCollectionName}
            openScopeEditor={vm.openScopeEditor}
          />
        </PanelSection>
      </div>
    </div>
  );
};

export default VariablesPanel;
