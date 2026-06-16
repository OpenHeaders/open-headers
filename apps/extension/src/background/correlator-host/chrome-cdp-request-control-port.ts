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
  CdpContinueResponse,
  CdpContinueWithAuth,
  CdpFulfillResponse,
  CdpGetRequestPostData,
  CdpGetResponseBody,
  CdpRequestControlPort,
  CdpRequestPostData,
  CdpResponseBody,
  CdpSessionTarget,
} from '@openheaders/oracle/correlator-cdp';
import type { CdpSessionSender } from './cdp-session-sender';

/** `Fetch.getResponseBody` result — body text + whether it is base64. */
interface RawFetchResponseBody {
  readonly body: string;
  readonly base64Encoded: boolean;
}

/** `Fetch.getRequestPostData` result — the outgoing body string (no base64 flag). */
interface RawFetchRequestPostData {
  readonly postData: string;
}

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

  async continueResponse(target: CdpSessionTarget, request: CdpContinueResponse): Promise<void> {
    await this.sender.sendOnSession(target.tabId, target.sessionId, 'Fetch.continueResponse', {
      requestId: request.requestId,
    });
  }

  async continueWithAuth(target: CdpSessionTarget, request: CdpContinueWithAuth): Promise<void> {
    await this.sender.sendOnSession(target.tabId, target.sessionId, 'Fetch.continueWithAuth', {
      requestId: request.requestId,
      authChallengeResponse: request.authChallengeResponse,
    });
  }

  async getResponseBody(target: CdpSessionTarget, request: CdpGetResponseBody): Promise<CdpResponseBody> {
    // The interception id (NOT the network id) keys `Fetch.getResponseBody` —
    // this reads the real reply of a request paused at the Fetch Response stage.
    const result = await this.sender.sendOnSession(target.tabId, target.sessionId, 'Fetch.getResponseBody', {
      requestId: request.requestId,
    });
    const raw = result as RawFetchResponseBody | undefined;
    if (typeof raw?.body !== 'string' || typeof raw.base64Encoded !== 'boolean') {
      throw new Error('Fetch.getResponseBody returned an unexpected shape');
    }
    return { body: raw.body, base64Encoded: raw.base64Encoded };
  }

  async getRequestPostData(target: CdpSessionTarget, request: CdpGetRequestPostData): Promise<CdpRequestPostData> {
    // The interception id (NOT the network id) keys `Fetch.getRequestPostData` —
    // this reads the outgoing body of a request paused at the Fetch Request stage.
    const result = await this.sender.sendOnSession(target.tabId, target.sessionId, 'Fetch.getRequestPostData', {
      requestId: request.requestId,
    });
    const raw = result as RawFetchRequestPostData | undefined;
    if (typeof raw?.postData !== 'string') {
      throw new Error('Fetch.getRequestPostData returned an unexpected shape');
    }
    return { postData: raw.postData };
  }
}
