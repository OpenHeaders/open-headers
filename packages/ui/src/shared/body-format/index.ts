// Pure body-format library — jsonish tokenizer + whitespace-only
// format/minify + wire-profile detection. Zero React. The override
// editors (quick popover, workbench rule fields, devtools documents)
// build their formatted-view/encode-on-save split on this.

export { type BodyProfile, detectBodyProfile, UNKNOWN_BODY_PROFILE } from './profile';
export { DEFAULT_BODY_INDENT, formatBody, isFormattableBody, minifyBody, reformatBody } from './reformat';
export { type JsonishToken, type JsonishTokenKind, MAX_TOKENIZE_LENGTH, tokenizeJsonish } from './tokenize';
