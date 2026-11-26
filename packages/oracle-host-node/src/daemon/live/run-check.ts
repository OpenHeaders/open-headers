/**
 * What this host refuses before a run's first step — the node hosts'
 * entry to the host-neutral check (`@openheaders/oracle/live/run-check`),
 * the one every host that runs a session step asks.
 */

export { checkWorkflowRun, type WorkflowRunCheck, type WorkflowRunHost } from '@openheaders/oracle/live/run-check';
