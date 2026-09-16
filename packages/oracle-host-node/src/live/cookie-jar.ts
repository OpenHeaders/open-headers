/**
 * The runtime-local cookie jar — lifted into oracle at the Execution
 * Place plan's Phase W so the node transport's jar legs and the
 * delegating transport share ONE registry per process. This module
 * keeps the node host's import path.
 */

export {
  CookieJar,
  cookieJarFor,
  peekCookieJar,
  resetCookieJars,
  type SetCookieInput,
} from '@openheaders/oracle/live/request-exec/cookie-jar';
