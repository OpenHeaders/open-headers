/**
 * Screen composition — frame assertions per state: dashboard chrome
 * and panes, filter/notice status line, single-pane collapse, rule and
 * environment drill-in, park screen, degradation. Every frame row must
 * measure exactly the terminal width.
 */

import { describe, expect, it } from 'vitest';
import type { KeyEvent } from '../../../src/tui/input';
import { visibleWidth } from '../../../src/tui/screen';
import { viewTui } from '../../../src/tui/view';
import { makeReadyApp, makeRulesPayload, makeSnapshot } from './fixtures';

const SIZE = { columns: 80, rows: 24 };

function key(name: string): KeyEvent {
  return { type: 'key', key: name, ctrl: false, alt: false, shift: false };
}

function strip(frame: string[]): string[] {
  // Frames stay assertable without SGR noise (NO_COLOR still emits reverse video).
  return frame.map((row) => row.replaceAll('\x1b[7m', '').replaceAll('\x1b[0m', ''));
}

describe('view', () => {
  it('dashboard frame: header strip, three panes, footer legend, exact widths', () => {
    const fx = makeReadyApp();
    const frame = viewTui(fx.app, SIZE, fx.ctx());
    expect(frame).toHaveLength(24);
    for (const row of frame) expect(visibleWidth(row)).toBeLessThanOrEqual(80);
    const text = strip(frame);
    expect(text[0]).toContain('OpenHeaders');
    expect(text[0]).toContain('team-a');
    expect(text[0]).toContain('env: staging');
    expect(text[0]).toContain('● connected');
    expect(text[0]).toContain('synced 0s ago');
    expect(text[1]).toContain('[1 Workspaces]');
    expect(text[1]).toContain('3 Rules ── 2 on · 1 off · 1 draft');
    expect(text.join('\n')).toContain('▸ team-a (git) *');
    expect(text.join('\n')).toContain('No environment');
    expect(text.join('\n')).toContain('◐ on  rate-limit-probe (draft)');
    expect(text[23]).toContain('↑↓ move');
    expect(text[23]).toContain('q quit');
  });

  it('the selected row of the focused pane renders in reverse video', () => {
    const fx = makeReadyApp();
    const frame = viewTui(fx.app, SIZE, fx.ctx());
    const selectedRow = frame.find((row) => row.includes('team-a (git)'));
    expect(selectedRow).toContain('\x1b[7m');
  });

  it('an active filter takes the status line and narrows the pane', () => {
    const fx = makeReadyApp();
    fx.app.handleEvent(key('3'), SIZE);
    fx.app.handleEvent(key('/'), SIZE);
    for (const char of ['a', 'u']) fx.app.handleEvent(key(char), SIZE);
    const text = strip(viewTui(fx.app, SIZE, fx.ctx()));
    expect(text[21]).toContain('filter: /au ─ 1 matches');
    expect(text.join('\n')).toContain('auth-header-inject');
    expect(text.join('\n')).not.toContain('legacy-token');
  });

  it('below 80 columns only the focused pane renders, under a digit tab row', () => {
    const fx = makeReadyApp();
    const frame = strip(viewTui(fx.app, { columns: 60, rows: 20 }, fx.ctx()));
    expect(frame[1]).toContain('[1 Workspaces]');
    expect(frame[1]).toContain('2 Environments');
    expect(frame[1]).toContain('3 Rules');
    expect(frame.join('\n')).toContain('team-a (git)');
    expect(frame.join('\n')).not.toContain('auth-header-inject');
  });

  it('empty rules pane renders the designed empty state with a next step', () => {
    const fx = makeReadyApp(makeSnapshot({ rules: makeRulesPayload({ rules: [] }) }));
    const text = strip(viewTui(fx.app, SIZE, fx.ctx())).join('\n');
    expect(text).toContain('No rules in this workspace yet.');
    expect(text).toContain('Press r to');
    expect(text).toContain('refresh.');
  });

  it('rule drill-in shows loading, then the honest definition with masked-free state line', () => {
    const fx = makeReadyApp();
    fx.app.handleEvent(key('3'), SIZE);
    fx.app.handleEvent(key('enter'), SIZE);
    let text = strip(viewTui(fx.app, SIZE, fx.ctx())).join('\n');
    expect(text).toContain('Rule: auth-header-inject');
    expect(text).toContain('loading…');
    fx.app.applyRuleDetail({
      workspaceId: 'ws-team',
      rule: { uid: 'rule-auth', name: 'auth-header-inject', type: 'header', enabled: true, published: true },
      definitionLines: ['{', '  "uid": "rule-auth"', '}'],
    });
    text = strip(viewTui(fx.app, SIZE, fx.ctx())).join('\n');
    expect(text).toContain('state   ● on · published — live on connected browser extensions');
    expect(text).toContain('type    header');
    expect(text).toContain('"uid": "rule-auth"');
    expect(text).toContain('Editing lives in the OpenHeaders app');
    expect(strip(viewTui(fx.app, SIZE, fx.ctx()))[23]).toContain('esc back');
  });

  it('environment drill-in lists variables with masked values staying masked', () => {
    const fx = makeReadyApp();
    fx.app.handleEvent(key('2'), SIZE);
    fx.app.handleEvent(key('enter'), SIZE);
    const text = strip(viewTui(fx.app, SIZE, fx.ctx())).join('\n');
    expect(text).toContain('Environment: staging');
    expect(text).toContain('baseUrl = https://staging.openheaders.io');
    expect(text).toContain('apiToken (masked)');
    expect(text).not.toContain('apiToken =');
  });

  it('parked: the §4.5 screen with daemon url, oh status hint, and countdown', () => {
    const fx = makeReadyApp();
    fx.app.state.snapshot = null;
    fx.app.applyUnreachable('unreachable');
    fx.app.setNextRetryAt(103_000);
    const frame = viewTui(fx.app, SIZE, fx.ctx());
    expect(frame).toHaveLength(24);
    const text = strip(frame).join('\n');
    expect(text).toContain('✕  Daemon unreachable or MCP disabled');
    expect(text).toContain('http://127.0.0.1:8137, or its MCP surface is turned off.');
    expect(text).toContain('oh status');
    expect(text).toContain('next attempt in 3s');
    expect(strip(frame)[23]).toContain('r retry now');
  });

  it('degraded keeps the panes, flips the header, and owns the status line', () => {
    const fx = makeReadyApp();
    fx.app.applyUnreachable('gone');
    const text = strip(viewTui(fx.app, SIZE, fx.ctx()));
    expect(text[0]).toContain('✕ daemon unreachable');
    expect(text.join('\n')).toContain('auth-header-inject');
    expect(text[21]).toContain('showing last known data — reconnecting…');
  });

  it('denial renders the daemon copy verbatim on the status line', () => {
    const fx = makeReadyApp();
    fx.app.applyDenied('permission denied: rules_list');
    const text = strip(viewTui(fx.app, SIZE, fx.ctx()));
    expect(text[21]).toContain('permission denied: rules_list');
  });
});
