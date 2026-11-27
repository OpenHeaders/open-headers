/**
 * An environment's name as a workflow's panel says it: "No environment"
 * where a run had none, and a word of its own for one the workspace no
 * longer holds.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import { useEnvironments } from '@openheaders/ui/shared/hooks/readers/useEnvironments';

export function useEnvironmentName(): (environmentId: string | null) => string {
  const t = useT();
  const { environments } = useEnvironments();
  return (environmentId) =>
    environmentId === null
      ? t('workbench.editors.live.status.noEnvironment')
      : (environments.find((each) => each.uid === environmentId)?.name ??
        t('workbench.editors.live.status.unknownEnv'));
}
