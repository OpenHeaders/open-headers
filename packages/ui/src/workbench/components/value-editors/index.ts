// The editor modals (JWTEditorModal, EncodedValueModal) are deliberately
// NOT re-exported here: they pull Monaco (via the shared CodeEditor),
// and `useValueEditAction` loads them lazily so TemplateInput callers
// never eat that dependency at import time. Import them from their own
// modules directly if a host ever needs one eagerly.
//
// The pure detection/codec layer lives in shared/value-detection and is
// re-exported here so existing callers keep one import site.
export * from '@openheaders/ui/shared/value-detection';
export {
  attachJwtEditTarget,
  buildJwtDecorations,
  JWT_EDIT_COMMAND,
  JWT_LINK_CLASS,
  type JwtDecorationSpec,
  type JwtLinkModel,
  type JwtLinkTarget,
  openJwtTarget,
  registerJwtLinkPlane,
} from './monaco-jwt-links';
export { type MonacoJwtEditResult, useMonacoJwtEdit } from './useMonacoJwtEdit';
export { useValueEditAction, type ValueEditActionResult } from './useValueEditAction';
