/**
 * Body capture + projection for the retention plane (the agent-traffic plan
 * §3). Bodies are the first NEW content plane since projection-boundary
 * redaction landed, so every body that crosses to a consumer is shaped
 * HERE — beside `projectRecord`, never in tool code:
 *
 *   - **Capture** normalizes an `InspectorHarBody` answer into the
 *     retained shape: encoding folded to `text` / `base64`, content
 *     capped at {@link TRAFFIC_BODY_CAP_CHARS} with an explicit
 *     `truncated` flag (base64 truncates on a 4-char boundary so the
 *     kept prefix stays decodable).
 *   - **Projection** applies the token-shape redaction scan to TEXT
 *     content (same stable markers as the header/URL planes — marker
 *     algebra holds across positions) unless an active reveal
 *     escalation passes `revealSecrets`. Base64 rides verbatim: binary
 *     must round-trip uncorrupted, and honesty about that gap lives in
 *     the tool descriptions.
 */

import { redactBodyText, TRAFFIC_BODY_CAP_CHARS, type TrafficBodyProjection } from '@openheaders/core/traffic';
import type { InspectorHarBody } from '@openheaders/core/types';

import type { ProjectRecordOptions } from './record';

/** The retained body shape — capped at capture, redacted at projection. */
export interface RetainedTrafficBody {
  content: string;
  encoding: 'text' | 'base64';
  truncated: boolean;
}

/** Normalize + cap one `body-attached` answer into the retained shape. */
export function captureBody(body: InspectorHarBody): RetainedTrafficBody {
  const encoding = body.encoding === 'base64' ? 'base64' : 'text';
  const cap = encoding === 'base64' ? Math.floor(TRAFFIC_BODY_CAP_CHARS / 4) * 4 : TRAFFIC_BODY_CAP_CHARS;
  const truncated = body.content.length > cap;
  return {
    content: truncated ? body.content.slice(0, cap) : body.content,
    encoding,
    truncated,
  };
}

/** Project one retained/pulled body for consumers — the ONLY body read
 *  shape. Redaction happens here, at the boundary. */
export function projectBody(body: RetainedTrafficBody, options?: ProjectRecordOptions): TrafficBodyProjection {
  const reveal = options?.revealSecrets === true;
  return {
    content: body.encoding === 'text' && !reveal ? redactBodyText(body.content) : body.content,
    encoding: body.encoding,
    truncated: body.truncated,
  };
}

/** Capture + project in one step — the on-demand (`traffic_get`) pull
 *  path, where the body is never retained. */
export function projectPulledBody(body: InspectorHarBody, options?: ProjectRecordOptions): TrafficBodyProjection {
  return projectBody(captureBody(body), options);
}
