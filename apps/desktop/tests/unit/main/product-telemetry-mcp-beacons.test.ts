/**
 * MCP usage observer → product-telemetry mapping (`TELEMETRY_PLAN.md`
 * §3, MCP visibility slice): the desktop shell installs the `/mcp`
 * module's process-wide observer and maps its policy-free signals onto
 * typed events — a served request is the `mcp-server` feature, an
 * initialize handshake is `mcp_client_connected` with the free-form
 * client name mapped through the picklist before it ever becomes an
 * event.
 */

import type { TelemetryEvent } from '@openheaders/core/telemetry';
import {
  notifyMcpClientInitialized,
  notifyMcpRequestServed,
  setMcpUsageObserver,
} from '@openheaders/oracle-host-node/mcp';
import { afterEach, describe, expect, it } from 'vitest';
import { installProductTelemetryMcpBeacons } from '../../../src/main/product-telemetry-mcp-beacons';

afterEach(() => {
  setMcpUsageObserver(null);
});

describe('installProductTelemetryMcpBeacons', () => {
  it('maps a served request onto the mcp-server feature signal', () => {
    const events: TelemetryEvent[] = [];
    installProductTelemetryMcpBeacons((event) => events.push(event));
    notifyMcpRequestServed();
    expect(events).toEqual([{ name: 'feature_used', feature: 'mcp-server' }]);
  });

  it('maps the initialize client name through the picklist — raw strings never become events', () => {
    const events: TelemetryEvent[] = [];
    installProductTelemetryMcpBeacons((event) => events.push(event));
    notifyMcpClientInitialized('claude-code');
    notifyMcpClientInitialized('Visual Studio Code');
    notifyMcpClientInitialized('My Custom Agent/1.0');
    expect(events).toEqual([
      { name: 'mcp_client_connected', client: 'claude-code' },
      { name: 'mcp_client_connected', client: 'vscode' },
      { name: 'mcp_client_connected', client: 'other' },
    ]);
  });

  it('reports nothing once the observer is cleared — the standalone-daemon posture', () => {
    const events: TelemetryEvent[] = [];
    installProductTelemetryMcpBeacons((event) => events.push(event));
    setMcpUsageObserver(null);
    notifyMcpRequestServed();
    notifyMcpClientInitialized('claude-code');
    expect(events).toEqual([]);
  });
});
