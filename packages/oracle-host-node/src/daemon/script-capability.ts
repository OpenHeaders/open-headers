/**
 * Host script capability — the node hosts' entry to the host-neutral
 * registry (`@openheaders/oracle/live/script-host/capability`): the
 * desktop app registers its two brokers, the standalone daemon its
 * Safe fork, and every node dispatch (the workbench Send, the chain
 * and suite runners, the session routes, the peer plane's posture
 * answer) resolves through the same gate the served web tab uses.
 */

export {
  getHostScriptCapability,
  type HostScriptCapabilities,
  type HostScriptCapability,
  type HostScriptRunOptions,
  type ResolvedScriptRunner,
  readScriptExecutionModeSlot,
  resolveScriptRunner,
  resolveSessionScriptHost,
  setHostScriptCapabilities,
} from '@openheaders/oracle/live/script-host/capability';
