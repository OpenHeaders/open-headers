export {
  COMPLETION_LANGUAGES,
  type RegisterOptions as MonacoCompletionOptions,
  registerVariableCompletionProvider,
} from './monaco-completion';
export { addRecent, listRecents, pruneRecents, RECENTS_CAP, type VariableRecents } from './recents';
export {
  type AutoSuggestionContextValue,
  SuggestionContextProvider,
  type SuggestionContextProviderProps,
  useAutoSuggestionContext,
} from './SuggestionContextProvider';
export { default as SuggestionRow } from './SuggestionRow';
export { default as TemplateInput } from './TemplateInput';
export type { GripResizeXEvent, GripResizeXHandler, TemplateInputProps } from './types';
export { useMonacoVariableCompletions } from './useMonacoVariableCompletions';
