/**
 * The post-claim landing — `server-admin-landing`.
 *
 * Pins the park-once / take-once contract the claim's way in relies
 * on: the host parks a section before the Workbench mounts, the shell
 * takes it exactly once, and a mount with nothing parked (every later
 * sign-in) reads null and lands on the workspace as before.
 */

import { postServerAdminLanding, takeServerAdminLanding } from '@openheaders/ui/workbench/data/server-admin-landing';
import { beforeEach, describe, expect, it } from 'vitest';

beforeEach(() => {
  // Drain whatever a previous leg parked — the module is a singleton.
  takeServerAdminLanding();
});

describe('server-admin-landing', () => {
  it('reads null when nothing is parked — an ordinary sign-in lands on the workspace', () => {
    expect(takeServerAdminLanding()).toBeNull();
  });

  it('parks the Users section by default and hands it over once', () => {
    postServerAdminLanding();
    expect(takeServerAdminLanding()).toBe('users');
    expect(takeServerAdminLanding()).toBeNull();
  });

  it('parks the named section and the latest post wins', () => {
    postServerAdminLanding('devices');
    postServerAdminLanding('audit');
    expect(takeServerAdminLanding()).toBe('audit');
    expect(takeServerAdminLanding()).toBeNull();
  });
});
