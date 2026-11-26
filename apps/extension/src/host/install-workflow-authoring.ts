/**
 * Declares that this surface authors a workflow's session steps (the
 * workflow runs plan, Decisions log, S16): a step's type selector offers
 * Listen, Send and Expect only in a build that opts in. Every surface
 * that mounts the workflow editor loads this — the popup, the panel and
 * the side panel through `install-capabilities`, the workbench page from
 * its own entry.
 */

import { registerCapability } from '@openheaders/core/capabilities';

if (__WORKFLOW_SESSION_AUTHORING__) registerCapability('workflowSessionAuthoring', () => true);
