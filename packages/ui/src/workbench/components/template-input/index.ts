export { TEMPLATE_INPUT_LINE_HEIGHT } from './editable-style';
export { default as MonacoSuggestOverlay, type MonacoSuggestOverlayProps } from './monaco/MonacoSuggestOverlay';
export { type MonacoRefGrammar, type OpenRun, type RefSpan, TEMPLATE_REF_GRAMMAR } from './monaco/ref-grammar';
export { type MonacoJsonShadowOptions, useMonacoJsonShadow } from './monaco/use-monaco-json-shadow';
export { type MonacoRefDecorationsOptions, useMonacoRefDecorations } from './monaco/use-monaco-ref-decorations';
export { type MonacoRefHoverOptions, useMonacoRefHover } from './monaco/use-monaco-ref-hover';
export {
  type MonacoVariableSuggestApi,
  type MonacoVariableSuggestOptions,
  type SuggestAnchor,
  useMonacoVariableSuggest,
} from './monaco/use-monaco-variable-suggest';
export { addRecent, listRecents, pruneRecents, RECENTS_CAP, type VariableRecents } from './recents';
export {
  type AutoSuggestionContextValue,
  SuggestionContextProvider,
  type SuggestionContextProviderProps,
  useAutoSuggestionContext,
} from './SuggestionContextProvider';
export { default as SuggestionRow } from './SuggestionRow';
export { default as TemplateInput } from './TemplateInput';
export type { GripResizeXEvent, GripResizeXHandler, TemplateInputPathParams, TemplateInputProps } from './types';
