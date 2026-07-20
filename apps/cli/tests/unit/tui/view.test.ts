/**
 * Screen composition — frame assertions per state: dashboard chrome
 * and panes, filter/notice status line, single-pane collapse, rule and
 * environment drill-in, park screen, degradation. Every frame row must
 * measure exactly the terminal width.
 */

import { describe, expect, it } from 'vitest';
import { detectCapabilities } from '../../../src/tui/capability';
import { createTuiTranslator } from '../../../src/tui/i18n';
import type { KeyEvent } from '../../../src/tui/input';
import { stripSgr, visibleWidth } from '../../../src/tui/screen';
import { viewTui } from '../../../src/tui/view';
import { makeReadyApp, makeRulesPayload, makeSnapshot, TEST_ENV } from './fixtures';

const SIZE = { columns: 80, rows: 24 };

function key(name: string, mods?: Partial<Pick<KeyEvent, 'ctrl' | 'alt' | 'shift'>>): KeyEvent {
  return { type: 'key', key: name, ctrl: false, alt: false, shift: false, ...mods };
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
    expect(text[0]).toContain('synced just now');
    expect(text[1]).toContain('[Workspaces]');
    expect(text[1]).toContain('Rules ── 2 on · 1 off · 1 draft');
    expect(text.join('\n')).toContain('▸ team-a (git) *');
    expect(text.join('\n')).toContain('No environment');
    expect(text.join('\n')).toContain('◐ on  rate-limit-probe (draft)');
    expect(text[23]).toContain('↑↓ move');
    expect(text[23]).toContain('q quit');
  });

  it('sync age floors to "just now" under 10s, then ticks in seconds', () => {
    const fx = makeReadyApp();
    const under = strip(viewTui(fx.app, SIZE, fx.ctx(100_000 + 9_000)));
    expect(under[0]).toContain('synced just now');
    const over = strip(viewTui(fx.app, SIZE, fx.ctx(100_000 + 10_000)));
    expect(over[0]).toContain('synced 10s ago');
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

  it('the filter query line outranks an active notice on the status line', () => {
    const fx = makeReadyApp();
    fx.app.handleEvent(key('3'), SIZE);
    fx.app.handleEvent(key('y'), SIZE);
    fx.app.handleEvent(key('/'), SIZE);
    for (const char of ['a', 'u']) fx.app.handleEvent(key(char), SIZE);
    const text = strip(viewTui(fx.app, SIZE, fx.ctx()));
    expect(text[21]).toContain('filter: /au ─ 1 matches');
    expect(text.join('\n')).not.toContain('uid copied');
  });

  it('below 80 columns only the focused pane renders, under a tab row', () => {
    const fx = makeReadyApp();
    const frame = strip(viewTui(fx.app, { columns: 60, rows: 20 }, fx.ctx()));
    expect(frame[1]).toContain('[Workspaces]');
    expect(frame[1]).toContain('Environments');
    expect(frame[1]).toContain('Rules');
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

  it('footer legends advertise ^K palette and ? help on dashboard and drill-in', () => {
    const fx = makeReadyApp();
    let footer = strip(viewTui(fx.app, SIZE, fx.ctx()))[23];
    expect(footer).toContain('^K palette');
    expect(footer).toContain('? help');
    fx.app.handleEvent(key('3'), SIZE);
    fx.app.handleEvent(key('enter'), SIZE);
    footer = strip(viewTui(fx.app, SIZE, fx.ctx()))[23];
    expect(footer).toContain('? help');
  });

  it('help overlay: cheatsheet box over the base frame, exact widths kept', () => {
    const fx = makeReadyApp();
    fx.app.handleEvent(key('?'), SIZE);
    const frame = viewTui(fx.app, SIZE, fx.ctx());
    expect(frame).toHaveLength(24);
    for (const row of frame) expect(visibleWidth(row)).toBeLessThanOrEqual(80);
    const text = frame.map(stripSgr);
    const joined = text.join('\n');
    expect(joined).toContain('Keyboard');
    expect(joined).toContain('Navigate');
    expect(joined).toContain('Act');
    expect(joined).toContain('Find');
    expect(joined).toContain('Session');
    expect(joined).toContain('command palette');
    expect(joined).toContain('esc close');
    expect(joined).toContain('Same keys as the app where the terminal allows it.');
  });

  it('help overlay teaches the Phase 4 verbs: toggle, publish, open / switch', () => {
    const fx = makeReadyApp();
    fx.app.handleEvent(key('?'), SIZE);
    const joined = viewTui(fx.app, SIZE, fx.ctx()).map(stripSgr).join('\n');
    expect(joined).toContain('open / switch');
    expect(joined).toContain('toggle rule');
    expect(joined).toContain('publish/unpub');
  });

  it('the base frame outside the modal rectangle is dim-washed', () => {
    const fx = makeReadyApp(makeSnapshot(), 100_000);
    const t = createTuiTranslator(TEST_ENV);
    const caps = detectCapabilities(TEST_ENV);
    fx.app.handleEvent(key('?'), SIZE);
    const frame = viewTui(fx.app, SIZE, { caps, t, now: 100_000 });
    // Header row (above the overlay box) carries the dim wash.
    expect(frame[0]).toContain('\x1b[38;2;140;140;140m');
    // A row inside the overlay rectangle keeps plain overlay cells.
    const helpRow = frame.find((row) => row.includes('Navigate'));
    expect(helpRow).toBeDefined();
  });

  it('palette overlay: input line, actions, selection marker, run legend', () => {
    const fx = makeReadyApp();
    fx.app.handleEvent(key('k', { ctrl: true }), SIZE);
    const frame = viewTui(fx.app, SIZE, fx.ctx());
    for (const row of frame) expect(visibleWidth(row)).toBeLessThanOrEqual(80);
    const text = frame.map(stripSgr);
    const joined = text.join('\n');
    expect(joined).toContain('^K');
    expect(joined).toContain('▸ Switch workspace…');
    expect(joined).toContain('Switch environment…');
    expect(joined).toContain('Toggle rule enabled');
    expect(joined).toContain('Publish / unpublish rule');
    expect(joined).toContain('Refresh now');
    expect(joined).toContain('Open help');
    expect(joined).toContain('⏎ run · esc close');
    const selectedRow = frame.find((row) => row.includes('Switch workspace…'));
    expect(selectedRow).toContain('\x1b[7m');
  });

  it('the second-stage picker titles the box and lists rows with the active marker', () => {
    const fx = makeReadyApp();
    fx.app.handleEvent(key('k', { ctrl: true }), SIZE);
    fx.app.handleEvent(key('enter'), SIZE);
    const joined = strip(viewTui(fx.app, SIZE, fx.ctx())).join('\n');
    expect(joined).toContain('Switch workspace');
    expect(joined).toContain('▸ team-a (git) *');
    expect(joined).toContain('personal (local)');
    expect(joined).not.toContain('Refresh now');
  });

  it('a pending write marks its row; the ack state renders directly', () => {
    const fx = makeReadyApp();
    fx.app.handleEvent(key('3'), SIZE);
    fx.app.handleEvent(key('space'), SIZE);
    let joined = strip(viewTui(fx.app, SIZE, fx.ctx())).join('\n');
    expect(joined).toContain('● on  auth-header-inject …');
    fx.app.applyRuleWriteAck({ uid: 'rule-auth', enabled: false, published: true });
    joined = strip(viewTui(fx.app, SIZE, fx.ctx())).join('\n');
    expect(joined).not.toContain('auth-header-inject …');
    expect(joined).toContain('○ off auth-header-inject');
  });

  it('a sticky write denial owns the status line in the error paint', () => {
    const fx = makeReadyApp();
    fx.app.applyWriteDenied('permission denied: write tools are disabled on this host');
    const text = strip(viewTui(fx.app, SIZE, fx.ctx()));
    expect(text[21]).toContain('permission denied: write tools are disabled on this host');
    expect(text[0]).toContain('● connected');
  });

  it('footer legends: rules pane advertises toggle/publish; ⏎ echoes the selected row', () => {
    const fx = makeReadyApp();
    // Workspaces pane, active row selected — no ⏎ verb.
    let footer = strip(viewTui(fx.app, SIZE, fx.ctx()))[23];
    expect(footer).not.toContain('⏎');
    fx.app.handleEvent(key('down'), SIZE);
    footer = strip(viewTui(fx.app, SIZE, fx.ctx()))[23];
    expect(footer).toContain('⏎ switch');
    fx.app.handleEvent(key('2'), SIZE);
    footer = strip(viewTui(fx.app, SIZE, fx.ctx()))[23];
    expect(footer).toContain('⏎ open');
    fx.app.handleEvent(key('3'), SIZE);
    footer = strip(viewTui(fx.app, SIZE, fx.ctx()))[23];
    expect(footer).toContain('␣ toggle');
    expect(footer).toContain('p publish');
    fx.app.handleEvent(key('enter'), SIZE);
    footer = strip(viewTui(fx.app, SIZE, fx.ctx()))[23];
    expect(footer).toContain('␣ toggle');
    expect(footer).toContain('p publish');
  });

  it('palette filtering narrows the action list and shows the honest empty line', () => {
    const fx = makeReadyApp();
    fx.app.handleEvent(key('k', { ctrl: true }), SIZE);
    for (const char of ['h', 'e', 'l']) fx.app.handleEvent(key(char), SIZE);
    let joined = strip(viewTui(fx.app, SIZE, fx.ctx())).join('\n');
    expect(joined).toContain('> hel');
    expect(joined).toContain('Open help');
    expect(joined).not.toContain('Refresh now');
    fx.app.handleEvent(key('z'), SIZE);
    joined = strip(viewTui(fx.app, SIZE, fx.ctx())).join('\n');
    expect(joined).toContain('no matching commands');
  });
});
