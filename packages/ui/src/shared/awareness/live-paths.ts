/**
 * Canonical LiveVariable / LiveWorkflow field paths for awareness
 * publishing.
 *
 * Lives in `shared/awareness/` for symmetry with `rule-paths.ts` and
 * `request-paths.ts`. The Live editors don't use antd Form (controlled
 * state instead) so focus mapping rides `data-field-path` attributes
 * on the FieldRow wrappers (`workbench/components/live/layout.tsx`).
 * A focus-capture handler on the editor container walks up via
 * `closest('[data-field-path]')` and reads the attribute
 * (`readFieldPath` is the shared primitive). These constants are the
 * single source of truth for the path strings so any future surface
 * (popup variable inspector, etc.) publishes the same paths verbatim.
 */

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
  /** Indexed step field paths for the workflow steps editor. Steps
   *  stay index-keyed (no uid in the step schema). */
  step(index: number, leaf: 'id' | 'requestUid' | 'gate' | 'captures'): string {
    return `steps.${index}.${leaf}`;
  },
  /** Whole-step path — published when a graph node is selected, where
   *  no single leaf is focused. */
  stepRoot(index: number): string {
    return `steps.${index}`;
  },
} as const;

/**
 * Extract the step index from any step-scoped workflow field path
 * (`steps.<n>` or `steps.<n>.<leaf...>`). Returns null for the bare
 * `steps` container path and for non-step paths — selection sync uses
 * this to map a focused form field back to its step.
 */
export function liveWorkflowStepIndexFromPath(path: string): number | null {
  const match = /^steps\.(\d+)(?:\.|$)/.exec(path);
  if (!match) return null;
  return Number(match[1]);
}
