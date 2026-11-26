/**
 * Whether this build authors a workflow's session steps (the workflow
 * runs plan, Decisions log, S16): the bundle configs stamp the build's
 * `OH_WORKFLOW_SESSION_AUTHORING` into `__WORKFLOW_SESSION_AUTHORING__`,
 * and the spine hands it to the agent's save tool. Off when the variable
 * is absent, and on an unbundled dev run.
 */

/** Build-time opt-in; absent when unbundled. */
declare const __WORKFLOW_SESSION_AUTHORING__: boolean | undefined;

export const WORKFLOW_SESSION_AUTHORING: boolean =
  typeof __WORKFLOW_SESSION_AUTHORING__ === 'boolean' && __WORKFLOW_SESSION_AUTHORING__;
