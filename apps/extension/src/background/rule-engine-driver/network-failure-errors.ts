/**
 * Chromium net-stack error codes that mean the request never reached
 * the wire. When DNR matched a URL but the request then failed with one
 * of these, the URL should be untracked — there was no response for the
 * rule to act on.
 */
export const NETWORK_FAILURE_ERRORS: ReadonlySet<string> = new Set([
  'net::ERR_CONNECTION_REFUSED',
  'net::ERR_CONNECTION_RESET',
  'net::ERR_CONNECTION_CLOSED',
  'net::ERR_NAME_NOT_RESOLVED',
  'net::ERR_INTERNET_DISCONNECTED',
  'net::ERR_ADDRESS_UNREACHABLE',
  'net::ERR_NETWORK_CHANGED',
  'net::ERR_DNS_TIMED_OUT',
  'net::ERR_TIMED_OUT',
  'net::ERR_CONNECTION_TIMED_OUT',
  'net::ERR_SOCKET_NOT_CONNECTED',
  'net::ERR_NETWORK_ACCESS_DENIED',
  'net::ERR_CERT_AUTHORITY_INVALID',
  'net::ERR_CERT_COMMON_NAME_INVALID',
  'net::ERR_CERT_DATE_INVALID',
  'net::ERR_SSL_PROTOCOL_ERROR',
  'net::ERR_BAD_SSL_CLIENT_AUTH_CERT',
  'net::ERR_CERT_REVOKED',
  'net::ERR_CERT_INVALID',
  'net::ERR_CERT_WEAK_SIGNATURE_ALGORITHM',
  'net::ERR_CERT_NON_UNIQUE_NAME',
  'net::ERR_CERT_WEAK_KEY',
  'net::ERR_CERT_NAME_CONSTRAINT_VIOLATION',
  'net::ERR_CERT_VALIDITY_TOO_LONG',
  'net::ERR_CERTIFICATE_TRANSPARENCY_REQUIRED',
  'net::ERR_CERT_SYMANTEC_LEGACY',
  'net::ERR_SSL_VERSION_OR_CIPHER_MISMATCH',
  'net::ERR_SSL_RENEGOTIATION_REQUESTED',
  'net::ERR_CT_CONSISTENCY_PROOF_PARSING_FAILED',
  'net::ERR_SSL_OBSOLETE_VERSION',
]);
