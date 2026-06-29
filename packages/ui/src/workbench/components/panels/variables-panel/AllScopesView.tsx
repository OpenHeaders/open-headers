/**
 * "All" view — every scope's variables grouped by priority (vault →
 * environment → collection → workspace → live). Each scope renders as a
 * `ScopeSection`; this component only computes the per-scope subtitles.
 */

import { ScopeSection } from './ScopeSection';
import type { AllScopeVariables, DisplayScope } from './types';

interface AllScopesViewProps {
  allVars: AllScopeVariables;
  activeEnvironmentName: string | null;
  defaultEnvironmentName: string | null;
  activeCollectionName: string | null;
  openScopeEditor: (scope: DisplayScope) => (() => void) | null;
}

export function AllScopesView({
  allVars,
  activeEnvironmentName,
  defaultEnvironmentName,
  activeCollectionName,
  openScopeEditor,
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

  return (
    <>
      <ScopeSection scope="vault" variables={allVars.vault} onOpenEditor={openScopeEditor('vault')} />
      <ScopeSection
        scope="environment"
        variables={allVars.environment}
        subtitle={envSubtitle}
        onOpenEditor={openScopeEditor('environment')}
      />
      <ScopeSection
        scope="collection"
        variables={allVars.collection}
        subtitle={activeCollectionName ?? 'No active collection'}
        onOpenEditor={openScopeEditor('collection')}
      />
      <ScopeSection scope="workspace" variables={allVars.workspace} onOpenEditor={openScopeEditor('workspace')} />
      <ScopeSection
        scope="live"
        variables={allVars.live}
        subtitle={
          allVars.live.length > 0
            ? `${allVars.live.filter((v) => v.resolved).length}/${allVars.live.length} resolved`
            : 'no live variables defined'
        }
        onOpenEditor={openScopeEditor('live')}
      />
    </>
  );
}
