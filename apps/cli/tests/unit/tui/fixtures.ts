/**
 * Shared TUI test fixtures — snapshot payload factories with Partial
 * overrides, a seeded app builder, and a canned ToolCaller that serves
 * the fixture payloads like the daemon's read tools would.
 */

import type { EnvironmentsPayload, RulesPayload, WorkspacesPayload } from '../../../src/format';
import { createTuiApp, type TuiApp } from '../../../src/tui/app';
import { detectCapabilities, type TerminalCapabilities } from '../../../src/tui/capability';
import type { DashboardSnapshot, ToolCaller } from '../../../src/tui/data';
import { createTuiTranslator, type TuiTranslator } from '../../../src/tui/i18n';
import type { ViewContext } from '../../../src/tui/view';

export function makeWorkspacesPayload(overrides?: Partial<WorkspacesPayload>): WorkspacesPayload {
  return {
    activeWorkspaceId: 'ws-team',
    workspaces: [
      { id: 'ws-team', name: 'team-a', kind: 'git', active: true, loaded: true },
      { id: 'ws-personal', name: 'personal', kind: 'local', active: false, loaded: false },
    ],
    ...overrides,
  };
}

export function makeEnvironmentsPayload(overrides?: Partial<EnvironmentsPayload>): EnvironmentsPayload {
  return {
    workspaceId: 'ws-team',
    activeEnvironmentId: 'env-staging',
    environments: [
      {
        uid: 'env-staging',
        name: 'staging',
        variables: [
          { name: 'baseUrl', value: 'https://staging.openheaders.io', masked: false },
          { name: 'apiToken', masked: true },
        ],
      },
      {
        uid: 'env-prod',
        name: 'production',
        variables: [{ name: 'baseUrl', value: 'https://api.openheaders.io', masked: false }],
      },
    ],
    ...overrides,
  };
}

export function makeRulesPayload(overrides?: Partial<RulesPayload>): RulesPayload {
  return {
    workspaceId: 'ws-team',
    rules: [
      { uid: 'rule-auth', name: 'auth-header-inject', type: 'header', enabled: true, published: true },
      { uid: 'rule-legacy', name: 'legacy-token', type: 'header', enabled: false, published: true },
      { uid: 'rule-probe', name: 'rate-limit-probe', type: 'header', enabled: true, published: false },
    ],
    ...overrides,
  };
}

export function makeSnapshot(overrides?: Partial<DashboardSnapshot>): DashboardSnapshot {
  return {
    workspaces: makeWorkspacesPayload(),
    environments: makeEnvironmentsPayload(),
    rules: makeRulesPayload(),
    ...overrides,
  };
}

export interface FixtureCall {
  readonly call: ToolCaller;
  readonly calls: { tool: string; args: Record<string, unknown> }[];
}

/** Serves the snapshot payloads; `rules_get` answers with a full rule. */
export function makeToolCaller(snapshot: DashboardSnapshot = makeSnapshot()): FixtureCall {
  const calls: { tool: string; args: Record<string, unknown> }[] = [];
  const call: ToolCaller = async (tool, args) => {
    calls.push({ tool, args });
    if (tool === 'workspaces_list') return JSON.stringify(snapshot.workspaces);
    if (tool === 'environments_list') return JSON.stringify(snapshot.environments);
    if (tool === 'rules_list') return JSON.stringify(snapshot.rules);
    if (tool === 'rules_get') {
      const uid = args.uid;
      const row = snapshot.rules.rules.find((rule) => rule.uid === uid);
      if (row === undefined) throw new Error(`no rule with uid '${String(uid)}'`);
      return JSON.stringify({
        workspaceId: snapshot.rules.workspaceId,
        rule: { ...row, conditions: [{ url: 'https://api.openheaders.io/*' }] },
      });
    }
    throw new Error(`unexpected tool ${tool}`);
  };
  return { call, calls };
}

export const TEST_ENV = { LANG: 'en_US.UTF-8', COLORTERM: 'truecolor' } as const;
export const PLAIN_ENV = { LANG: 'en_US.UTF-8', NO_COLOR: '1' } as const;

export interface AppFixture {
  readonly app: TuiApp;
  readonly t: TuiTranslator;
  readonly caps: TerminalCapabilities;
  ctx(now?: number): ViewContext;
}

/** An app seeded to `ready` with the fixture snapshot, NO_COLOR tier. */
export function makeReadyApp(snapshot: DashboardSnapshot = makeSnapshot(), now = 100_000): AppFixture {
  const t = createTuiTranslator(PLAIN_ENV);
  const caps = detectCapabilities(PLAIN_ENV);
  const app = createTuiApp({ t, daemonUrl: 'http://127.0.0.1:8137', now: () => now });
  app.applySnapshot(snapshot);
  return {
    app,
    t,
    caps,
    ctx(nowMs = now) {
      return { caps, t, now: nowMs };
    },
  };
}
