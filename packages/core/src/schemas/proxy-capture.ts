/**
 * Proxy capture plane — persisted settings for the daemon's L7 capture
 * proxy (PROXY_PLAN.md Phase 2). Host-local by design: the port and the
 * decrypt-scope list are statements about THIS machine's capture proxy,
 * never synced. The scope list is the §2.4 scoped-decrypt-by-default
 * control — an empty list intercepts nothing.
 */

import * as v from 'valibot';

export const ProxyCaptureSettingsSchema = v.object({
  version: v.literal(1),
  /** The local port the capture proxy binds when started. */
  port: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(65535)),
  /** Decrypt-scope patterns (`example.com`, `*.example.com`, IP literal). */
  scopePatterns: v.array(v.string()),
});
