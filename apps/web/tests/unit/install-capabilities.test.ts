/**
 * The web host's workflow capabilities (the workflow runs plan,
 * Decisions log, S15): a signed-in tab runs a workflow itself, session
 * steps included, and declares so; the anonymous public view has no
 * wire a step could go out through and declares that it runs none.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  beforeEach(() => {
    vi.resetModules();
    h.publicView = false;
  });

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
});
