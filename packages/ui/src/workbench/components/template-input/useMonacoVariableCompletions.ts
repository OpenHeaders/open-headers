/**
 * React glue for the Monaco completion provider. Registers once per
 * Monaco instance and keeps the suggestion getter pointed at the
 * latest snapshot so popover fires always see fresh state.
 *
 * Usage:
 *
 * ```tsx
 * const register = useMonacoVariableCompletions();
 * <Editor onMount={(editor, monaco) => register(monaco)} />
 * ```
 *
 * The returned function can be called from an editor's `onMount`; the
 * hook handles disposal when the component unmounts. One registration
 * per Monaco instance is idempotent — if callers invoke it twice
 * Monaco allows both providers to live side-by-side but we keep just
 * one.
 */

import { useVariableSuggestions } from '@openheaders/ui/shared/hooks/useVariableSuggestions';
import type { SuggestionContext, VariableSuggestion } from '@openheaders/core/variables';
import type * as monacoType from 'monaco-editor';
import { useCallback, useEffect, useRef } from 'react';
import { useSettingValue } from '../../settings/hooks';
import { registerVariableCompletionProvider } from './monaco-completion';
import { useAutoSuggestionContext } from './SuggestionContextProvider';

export function useMonacoVariableCompletions(contextOverride?: SuggestionContext): (monaco: typeof monacoType) => void {
  const autoContext = useAutoSuggestionContext();
  const context = contextOverride ?? autoContext;
  const { suggestions } = useVariableSuggestions(context);

  const suggestionsRef = useRef<ReadonlyArray<VariableSuggestion>>(suggestions);
  suggestionsRef.current = suggestions;

  // Track the active registration so we can dispose on unmount or when
  // the caller re-mounts the editor.
  const disposeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Dispose on unmount — any registration created by `register`
    // tears down with the component.
    return () => {
      disposeRef.current?.();
      disposeRef.current = null;
    };
  }, []);

  const enabled = useSettingValue('rulesEngine.variableAutocomplete');

  return useCallback(
    (monaco: typeof monacoType) => {
      // Drop the old registration (fresh editor mount / context swap /
      // setting flipped off).
      disposeRef.current?.();
      if (!enabled) return;
      const d = registerVariableCompletionProvider(monaco, {
        getSuggestions: () => suggestionsRef.current,
        context,
      });
      disposeRef.current = () => d.dispose();
    },
    [context, enabled],
  );
}
