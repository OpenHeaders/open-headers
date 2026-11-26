/**
 * The web host's workflow capabilities (the workflow runs plan,
 * Decisions log, S15): a signed-in tab runs a workflow itself, session
 * steps included, and declares so; the anonymous public view has no
 * wire a step could go out through and declares that it runs none.
 * A signed-in tab authors session steps only in a build that opts in
 * (Decisions log, S16).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ publicView: false }));

vi.mock('@/host/public-view', () => ({ isPublicView: () => h.publicView }));

// Each case re-imports the install module cold, with the registry it
// registered into.
vi.setConfig({ testTimeout: 30_000 });

async function installed() {
  await import('@/host/install-capabilities');
  return import('@openheaders/core/capabilities');
}

describe('install-capabilities — workflows', () => {
  // The build's opt-in is a constant the bundler writes in; a test run
  // has no bundler, so each case states it.
  beforeEach(() => {
    vi.resetModules();
    h.publicView = false;
    vi.stubGlobal('__WORKFLOW_SESSION_AUTHORING__', false);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('a signed-in tab runs workflows and their session steps', async () => {
    const { hasCapability } = await installed();
    expect(hasCapability('workflowRunUnavailable')).toBe(false);
    expect(hasCapability('workflowSessionSteps')).toBe(true);
  });

  it('the public view runs no workflow', async () => {
    h.publicView = true;
    const { hasCapability } = await installed();
    expect(hasCapability('workflowRunUnavailable')).toBe(true);
    expect(hasCapability('workflowSessionSteps')).toBe(false);
  });

  it('a build that did not opt in authors no session step', async () => {
    const { hasCapability } = await installed();
    expect(hasCapability('workflowSessionAuthoring')).toBe(false);
  });

  it('a build that opted in authors them in a signed-in tab, and never in the public view', async () => {
    vi.stubGlobal('__WORKFLOW_SESSION_AUTHORING__', true);
    expect((await installed()).hasCapability('workflowSessionAuthoring')).toBe(true);

    vi.resetModules();
    h.publicView = true;
    expect((await installed()).hasCapability('workflowSessionAuthoring')).toBe(false);
  });
});
