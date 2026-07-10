// The editor modals (JWTEditorModal, EncodedValueModal) are deliberately
// NOT re-exported here: they pull Monaco (via the shared CodeEditor),
// and `useValueEditAction` loads them lazily so TemplateInput callers
// never eat that dependency at import time. Import them from their own
// modules directly if a host ever needs one eagerly.
export {
  type DetectedBase64,
  type DetectedCookie,
  type DetectedCsp,
  type DetectedDataUri,
  type DetectedHex,
  type DetectedJsonString,
  type DetectedJsonValue,
  type DetectedJWT,
  type DetectedTimestamp,
  type DetectedUrlEncoded,
  type DetectedValue,
  detectValueType,
} from './detect';
export {
  type DecodedBase64,
  type DecodedDataUri,
  type DecodedHex,
  type DecodedJsonValue,
  type DecodedTimestamp,
  encodeBase64,
  encodeCookieList,
  encodeCspList,
  encodeDataUri,
  encodeHex,
  encodeJsonString,
  encodeJsonValue,
  encodeTimestamp,
  tryDecodeBase64,
  tryDecodeCookieList,
  tryDecodeCspList,
  tryDecodeDataUri,
  tryDecodeHex,
  tryDecodeJsonString,
  tryDecodeJsonValue,
  tryDecodeTimestamp,
  tryDecodeUrlComponent,
} from './encodings';
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
  buildJwtDecorations,
  JWT_EDIT_COMMAND,
  JWT_LINK_CLASS,
  type JwtDecorationSpec,
  type JwtLinkModel,
  type JwtLinkTarget,
  openJwtTarget,
  registerJwtLinkPlane,
} from './monaco-jwt-links';
export { type JwtScanHit, scanForJWTs } from './scan';
export { type MonacoJwtEditResult, useMonacoJwtEdit } from './useMonacoJwtEdit';
export { useValueEditAction, type ValueEditActionResult } from './useValueEditAction';
