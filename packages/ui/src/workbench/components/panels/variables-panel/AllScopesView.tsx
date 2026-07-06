/**
 * "All" view — every scope's variables grouped by priority (vault →
 * environment → collection → workspace → live). Each scope renders as a
 * `ScopeSection`; this component only computes the per-scope subtitles
 * and header actions (Edit everywhere; the environment section swaps in
 * Create / Select when no env is active).
 */

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
  // If a default env is configured and differs from the active one,
  // surface it in the environment-scope subtitle so users understand why
  // a value is resolving from a different env than the one they picked.
  const envSubtitle = (() => {
    if (activeEnvironmentName && defaultEnvironmentName && defaultEnvironmentName !== activeEnvironmentName) {
      return `${activeEnvironmentName} · default: ${defaultEnvironmentName}`;
    }
    if (activeEnvironmentName) return activeEnvironmentName;
    if (defaultEnvironmentName) return `No environment · default: ${defaultEnvironmentName}`;
    return 'No environment';
  })();

  const editAction = (scope: DisplayScope): ScopeHeaderAction | null => {
    const run = openScopeEditor(scope);
    if (!run) return null;
    return { label: 'Edit', tooltip: `Open the ${SCOPE_CONFIG[scope].label.toLowerCase()} variables editor`, run };
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
        subtitle={activeCollectionName ?? 'No active collection'}
        action={editAction('collection')}
      />
      <ScopeSection scope="workspace" variables={allVars.workspace} action={editAction('workspace')} />
      <ScopeSection
        scope="live"
        variables={allVars.live}
        subtitle={
          allVars.live.length > 0
            ? `${allVars.live.filter((v) => v.resolved).length}/${allVars.live.length} resolved`
            : 'no live variables defined'
        }
        action={editAction('live')}
        isLast
      />
    </>
  );
}
