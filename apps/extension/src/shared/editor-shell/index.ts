/**
 * Editor-shell — universal editor wiring layer.
 *
 * See `docs/EDITOR_SHELL_DESIGN.md` (v4) and `docs/EDITOR_SHELL_SPIKE.md`
 * for the bug-class motivation + measurement actuals. Every workbench
 * editor (Environment, Rule, Request, Vault, Variables, Template,
 * LiveVariable, LiveWorkflow) routes its wiring through `useEditorShell`;
 * the AST lint test (`tests/unit/editor-shell/editor-shell-lint.test.ts`)
 * pins both the `<EditorHeader>` and `<EntityScopeProvider>` mounts.
 */

export { useEditorShell, type UseEditorShellInput, type UseEditorShellOutput, type EditorShellFieldProps } from './use-editor-shell';
export { useReprime, type UseReprimeInput, type UseReprimeOutput } from './use-reprime';
export type { EditorShellHeaderWiring, EditorShellScopeWiring, EditorHeaderContentProps } from './types';
