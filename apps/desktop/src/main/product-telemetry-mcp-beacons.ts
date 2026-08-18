/**
 * Product-telemetry beacons for the embedded MCP surface
 * (the telemetry plan §3, MCP visibility slice) — the desktop's one
 * place that maps the `/mcp` module's policy-free usage observer onto
 * the vocabulary's typed events. The daemon spine stays telemetry-free
 * and the standalone daemon never installs an observer, so only the
 * desktop-embedded host counts anything:
 *
 *   - a served request is the `mcp-server` feature in real use
 *     (once per session via the controller latch);
 *   - an `initialize` handshake announces which AI client connected —
 *     the free-form `clientInfo.name` maps through the picklist here,
 *     so a raw client string never becomes an event (once per client
 *     per session per UTC day via the controller latch).
 */

import { type TelemetryEvent, toTelemetryMcpClient } from '@openheaders/core/telemetry';
import { setMcpUsageObserver } from '@openheaders/oracle-host-node/mcp';

export function installProductTelemetryMcpBeacons(track: (event: TelemetryEvent) => void): void {
  setMcpUsageObserver({
    requestServed: () => {
      track({ name: 'feature_used', feature: 'mcp-server' });
    },
    clientInitialized: (clientName) => {
      track({ name: 'mcp_client_connected', client: toTelemetryMcpClient(clientName) });
    },
  });
}
