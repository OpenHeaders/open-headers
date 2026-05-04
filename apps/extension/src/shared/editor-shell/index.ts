/**
 * Editor-shell — universal editor wiring layer (Phase A spike).
 *
 * See `docs/EDITOR_SHELL_DESIGN.md` and `docs/EDITOR_SHELL_SPIKE.md`
 * for the bug-class motivation + measurement protocol. Every workbench
 * editor (Environment, Rule, Request, Vault, Variables, Template,
 * LiveVariable, LiveWorkflow) routes its wiring through `useEditorShell`
 * once the spike verdict is PROCEED.
 */

export { useEditorShell, type EditorMode, type UseEditorShellInput, type UseEditorShellOutput, type EditorShellReprime, type EditorShellFieldProps } from './use-editor-shell';
export { useReprime, type UseReprimeInput, type UseReprimeOutput } from './use-reprime';
export type { EditorShellHeaderWiring, EditorShellScopeWiring, EditorHeaderContentProps } from './types';
