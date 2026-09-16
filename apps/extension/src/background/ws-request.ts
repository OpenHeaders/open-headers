/**
 * The service worker's wire request helper — lifted into
 * `@openheaders/oracle/sync/client/wire-request` (host-neutral: the
 * desktop app's main process rides the same correlation toward its
 * joined servers). This path stays for the SW's handlers and their
 * pins.
 */

export {
  __resetWsRequestForTests,
  type WsRequestOptions,
  wsRequest,
} from '@openheaders/oracle/sync/client/wire-request';
