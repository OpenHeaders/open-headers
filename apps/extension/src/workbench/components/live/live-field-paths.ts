/**
 * Canonical V5.LiveVariable / V5.LiveWorkflow field paths for awareness
 * publishing.
 *
 * The Live editors don't use antd Form (controlled state instead) so
 * focus mapping rides `data-field-path` attributes on the FieldRow
 * wrappers (`./layout.tsx`). A focus-capture handler on the editor
 * container walks up via `closest('[data-field-path]')` and reads the
 * attribute (`readFieldPath` lives in the shared awareness module so
 * non-Live editors share the same primitive). These constants are the
 * single source of truth for the path strings so any future surface
 * (popup variable inspector, etc.) publishes the same paths verbatim.
 */

export { readFieldPath } from '@/shared/awareness/field-path';

export const LIVE_VARIABLE_FIELD = {
  name: 'name',
  description: 'description',
  enabled: 'enabled',
  requireFreshOnRuleBuild: 'requireFreshOnRuleBuild',
  workflowUid: 'workflowUid',
  stepId: 'stepId',
  captureName: 'captureName',
  manualOverrideValue: 'manualOverride.value',
  manualOverrideUntil: 'manualOverride.until',
} as const;

export const LIVE_WORKFLOW_FIELD = {
  name: 'name',
  description: 'description',
  enabled: 'enabled',
  refresh: 'refresh',
  steps: 'steps',
  /** Indexed step field paths for the workflow steps editor. */
  step(index: number, leaf: 'id' | 'requestUid' | 'gate' | 'captures'): string {
    return `steps.${index}.${leaf}`;
  },
} as const;

