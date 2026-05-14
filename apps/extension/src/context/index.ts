/**
 * `@context` barrel.
 *
 * The context layer proper — providers + sync mirrors + mutator
 * context — lives in `@openheaders/ui/context` and is re-exported
 * here so existing `@context` / `@context/*` call sites keep working.
 *
 * `ThemeContext` and `KeyboardNavContext` stay host-local: they pull
 * `@/themes`, `@/workbench/settings`, and the keyboard hooks, none of
 * which belong in the shared UI package.
 */

export { ThemeContext, ThemeProvider, useTheme } from './ThemeContext';
export { KeyboardNavProvider, useKeyboardNav } from './KeyboardNavContext';
export * from '@openheaders/ui/context';
