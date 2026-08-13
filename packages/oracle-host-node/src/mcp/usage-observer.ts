/**
 * MCP usage observer — a policy-free seam reporting that the MCP
 * surface is actually in use: an admitted request being served, and
 * the client identity an `initialize` handshake announced. Nothing is
 * counted here and the daemon spine stays a pure server: a host shell
 * that wants visibility injects an observer (the desktop app maps
 * these signals onto its anonymous usage counters), and a deployment
 * that never installs one — the standalone daemon — reports nothing,
 * by construction.
 */

export interface McpUsageObserver {
  /** An admitted POST (enabled + token-valid + parseable) is about to be served. */
  requestServed(): void;
  /** An `initialize` handshake announced the connecting client's free-form `clientInfo.name`. */
  clientInitialized(clientName: string): void;
}

let observer: McpUsageObserver | null = null;

/** Install (or clear) the process-wide observer — host shells only. */
export function setMcpUsageObserver(next: McpUsageObserver | null): void {
  observer = next;
}

/** Fire-and-forget by contract: a throwing observer never fails the request. */
export function notifyMcpRequestServed(): void {
  try {
    observer?.requestServed();
  } catch {
    // best-effort by contract
  }
}

export function notifyMcpClientInitialized(clientName: string): void {
  try {
    observer?.clientInitialized(clientName);
  } catch {
    // best-effort by contract
  }
}
