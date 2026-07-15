/**
 * "All" view — every scope's variables grouped by priority (vault →
 * environment → collection → workspace → live). Each scope renders as a
 * `ScopeSection`; this component only computes the per-scope subtitles
 * and header actions (Edit everywhere; the environment section swaps in
 * Create / Select when no env is active).
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import { type ScopeHeaderAction, ScopeSection } from './ScopeSection';
import { SCOPE_CONFIG, type AllScopeVariables, type DisplayScope } from './types';

interface AllScopesViewProps {
  allVars: AllScopeVariables;
  activeEnvironmentName: string | null;
  defaultEnvironmentName: string | null;
  activeCollectionName: string | null;
  openScopeEditor: (scope: DisplayScope) => (() => void) | null;
  environmentAction: ScopeHeaderAction | null;
}

export function AllScopesView({
  allVars,
  activeEnvironmentName,
  defaultEnvironmentName,
  activeCollectionName,
  openScopeEditor,
  environmentAction,
}: AllScopesViewProps) {
  const t = useT();
  // If a default env is configured and differs from the active one,
  // surface it in the environment-scope subtitle so users understand why
  // a value is resolving from a different env than the one they picked.
  const envSubtitle = (() => {
    if (activeEnvironmentName && defaultEnvironmentName && defaultEnvironmentName !== activeEnvironmentName) {
      return t('workbench.variables.panel.env.subtitleActiveDefault', {
        active: activeEnvironmentName,
        default: defaultEnvironmentName,
      });
    }
    if (activeEnvironmentName) return activeEnvironmentName;
    if (defaultEnvironmentName) {
      return t('workbench.variables.panel.env.subtitleNoneDefault', { default: defaultEnvironmentName });
    }
    return t('workbench.variables.panel.env.subtitleNone');
  })();

  const editAction = (scope: DisplayScope): ScopeHeaderAction | null => {
    const run = openScopeEditor(scope);
    if (!run) return null;
    return {
      label: t('workbench.variables.panel.action.edit'),
      tooltip: t('workbench.variables.panel.action.editTooltip', {
        scope: t(SCOPE_CONFIG[scope].labelKey).toLowerCase(),
      }),
      run,
    };
  };

  return (
    <>
      <ScopeSection scope="vault" variables={allVars.vault} action={editAction('vault')} />
      <ScopeSection
        scope="environment"
        variables={allVars.environment}
        subtitle={envSubtitle}
        action={environmentAction}
      />
      <ScopeSection
        scope="collection"
        variables={allVars.collection}
        subtitle={activeCollectionName ?? t('workbench.variables.panel.collection.noneActive')}
        action={editAction('collection')}
      />
      <ScopeSection scope="workspace" variables={allVars.workspace} action={editAction('workspace')} />
      <ScopeSection
        scope="live"
        variables={allVars.live}
        subtitle={
          allVars.live.length > 0
            ? t('workbench.variables.panel.live.resolvedCount', {
                resolved: allVars.live.filter((v) => v.resolved).length,
                total: allVars.live.length,
              })
            : t('workbench.variables.panel.live.noneDefined')
        }
        action={editAction('live')}
        isLast
      />
    </>
  );
}
