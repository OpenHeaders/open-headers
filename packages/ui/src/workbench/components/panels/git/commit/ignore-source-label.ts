/**
 * An ignored row's dim provenance — which ignore source matched it.
 */

import type { WorkspaceTreeWorkingChangeWire } from '@openheaders/core/bridge';
import type { Translate } from '@openheaders/ui/context/LocaleContext';

export function ignoreSourceLabel(
  t: Translate,
  source: NonNullable<WorkspaceTreeWorkingChangeWire['ignoreSource']>,
): string {
  if (source.kind === 'gitignore') return '.gitignore';
  if (source.kind === 'exclude') return 'exclude';
  if (source.kind === 'nested') return source.source;
  return t('workbench.commitTool.ignoreSourceGlobal');
}
