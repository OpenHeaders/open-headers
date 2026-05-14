/**
 * `@context` barrel.
 *
 * The context layer proper — providers + sync mirrors + mutator
 * context — lives in `@openheaders/ui/context` and is re-exported
 * here so existing `@context` / `@context/*` call sites keep working.
 *
 * `ThemeContext` and `KeyboardNavContext` stay host-local: they pull
 * `@/themes`, `@openheaders/ui/workbench/settings`, and the keyboard hooks, none of
 * which belong in the shared UI package.
 */

export * from '@openheaders/ui/context';
export { KeyboardNavProvider, useKeyboardNav } from './KeyboardNavContext';
export { ThemeContext, ThemeProvider, useTheme } from './ThemeContext';
