/**
 * Chrome adapter for the oracle {@link CdpRequestControlPort} — the
 * imperative per-paused-request port. Each typed reaction maps directly to
 * its `Fetch.*` command on the request's session via the shared
 * {@link CdpSessionSender}. Wired in Phase D as the output edge of the
 * `Fetch.requestPaused` loop; these reactions are tied to a live
 * `requestId` and are never replayed.
 */

import type {
  CdpContinueRequest,
  CdpContinueWithAuth,
  CdpFulfillResponse,
  CdpRequestControlPort,
  CdpSessionTarget,
} from '@openheaders/oracle/correlator-cdp';
import type { CdpSessionSender } from './cdp-session-sender';

export class ChromeCdpRequestControlPort implements CdpRequestControlPort {
  private readonly sender: CdpSessionSender;

  constructor(sender: CdpSessionSender) {
    this.sender = sender;
  }

  get available(): boolean {
    return this.sender.cdpAvailable;
  }

  async fulfill(target: CdpSessionTarget, response: CdpFulfillResponse): Promise<void> {
    await this.sender.sendOnSession(target.tabId, target.sessionId, 'Fetch.fulfillRequest', {
      requestId: response.requestId,
      responseCode: response.responseCode,
      ...(response.responseHeaders !== undefined
        ? { responseHeaders: response.responseHeaders.map((h) => ({ name: h.name, value: h.value })) }
        : {}),
      ...(response.body !== undefined ? { body: response.body } : {}),
      ...(response.responsePhrase !== undefined ? { responsePhrase: response.responsePhrase } : {}),
    });
  }

  async continueRequest(target: CdpSessionTarget, request: CdpContinueRequest): Promise<void> {
    await this.sender.sendOnSession(target.tabId, target.sessionId, 'Fetch.continueRequest', {
      requestId: request.requestId,
      ...(request.url !== undefined ? { url: request.url } : {}),
      ...(request.method !== undefined ? { method: request.method } : {}),
      ...(request.postData !== undefined ? { postData: request.postData } : {}),
      ...(request.headers !== undefined
        ? { headers: request.headers.map((h) => ({ name: h.name, value: h.value })) }
        : {}),
      ...(request.interceptResponse !== undefined ? { interceptResponse: request.interceptResponse } : {}),
    });
  }

  async continueWithAuth(target: CdpSessionTarget, request: CdpContinueWithAuth): Promise<void> {
    await this.sender.sendOnSession(target.tabId, target.sessionId, 'Fetch.continueWithAuth', {
      requestId: request.requestId,
      authChallengeResponse: request.authChallengeResponse,
    });
  }
}
