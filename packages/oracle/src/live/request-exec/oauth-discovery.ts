/**
 * Authorization-server discovery over the wire (RFC 8414 §3 / OpenID
 * Connect Discovery §4) — the host-neutral GET behind the editor's
 * Discover action. The candidate URLs come from `@openheaders/core/oauth`
 * (`planDiscovery`); each is read in order over the host's injected
 * {@link RequestTransport} — the same seam every token POST rides, so
 * the node hosts' proxy resolution and trust store cover the document
 * too. A candidate that answers anything but a JSON document with a
 * 2xx moves the walk on; the first document that parses is the answer,
 * and one naming another issuer is a refusal (§3.3), not a miss. A
 * transport failure stops the walk as it is.
 *
 * Not a token request: the refresh bucket is not paid.
 */

import { type OAuth2ServerMetadata, parseAuthorizationServerMetadata, planDiscovery } from '@openheaders/core/oauth';
import { OAuth2FlowError } from './oauth-exchange';
import type { RequestTransport, TransportResponse } from './transport';

/** Same streamed-read cap the token exchange rides. */
const MAX_BODY_BYTES = 2 * 1024 * 1024;

export const DISCOVERY_STEP = 'discovery';

export interface OAuth2DiscoveryResult {
  metadata: OAuth2ServerMetadata;
  /** The candidate that answered. */
  url: string;
}

export async function discoverAuthorizationServer(
  input: string,
  transport: RequestTransport,
): Promise<OAuth2DiscoveryResult> {
  let plan: ReturnType<typeof planDiscovery>;
  try {
    plan = planDiscovery(input);
  } catch (err) {
    throw new OAuth2FlowError(DISCOVERY_STEP, (err as Error).message);
  }
  let lastAnswer = '';
  for (const url of plan.candidates) {
    const response = await transport.send({
      method: 'GET',
      url,
      headers: [{ key: 'Accept', value: 'application/json' }],
      body: { kind: 'none' },
      redirect: 'follow',
      credentials: 'omit',
      maxBodyBytes: MAX_BODY_BYTES,
    });
    if (response.status < 200 || response.status >= 300) {
      lastAnswer = `${url} answered ${response.status} ${response.statusText}`;
      continue;
    }
    const json = safeJsonParse(response.body);
    if (json === null) {
      lastAnswer = `${url} answered a non-JSON body: ${truncate(response.body, 120)}`;
      continue;
    }
    try {
      return { metadata: parseAuthorizationServerMetadata(json, plan.issuer), url };
    } catch (err) {
      throw new OAuth2FlowError(DISCOVERY_STEP, (err as Error).message);
    }
  }
  throw new OAuth2FlowError(DISCOVERY_STEP, `no metadata document for ${plan.issuer} (${lastAnswer})`);
}

function safeJsonParse(text: TransportResponse['body']): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}
