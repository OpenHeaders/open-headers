// JWTEditorModal is deliberately NOT re-exported here: it pulls Monaco
// (via the shared CodeEditor), and `useJwtEditAction` loads it lazily so
// TemplateInput callers never eat that dependency at import time. Import
// it from './JWTEditorModal' directly if a host ever needs it eagerly.
export { type DetectedJWT, type DetectedValue, detectValueType } from './detect';
export {
  type DecodedJWT,
  decodeJWT,
  encodeJWT,
  formatJSON,
  getJWTExpiration,
  isJWT,
  JWT_CLAIM_DESCRIPTIONS,
  type JWTExpirationInfo,
  validateJSON,
} from './jwt';
export {
  attachJwtEditTarget,
  buildJwtLinks,
  JWT_LINK_SCHEME,
  type JwtLinkModel,
  type JwtLinkTarget,
  parseJwtLinkUrl,
  registerJwtLinkPlane,
} from './monaco-jwt-links';
export { type JwtScanHit, scanForJWTs } from './scan';
export { type JwtEditActionResult, useJwtEditAction } from './useJwtEditAction';
export { type MonacoJwtEditResult, useMonacoJwtEdit } from './useMonacoJwtEdit';
