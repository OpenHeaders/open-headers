/**
 * App state machine — movement/focus keys, the `/` filter protocol,
 * drill-in/out, yank, mouse hit-testing, connection phases, and
 * identity-stable selection across refreshes.
 */

import { describe, expect, it } from 'vitest';
import { createTuiApp, type TuiApp } from '../../../src/tui/app';
import { createTuiTranslator } from '../../../src/tui/i18n';
import type { KeyEvent, MouseEvent } from '../../../src/tui/input';
import { makeRulesPayload, makeSnapshot, PLAIN_ENV } from './fixtures';

const SIZE = { columns: 80, rows: 24 };

function key(name: string, mods?: Partial<Pick<KeyEvent, 'ctrl' | 'alt' | 'shift'>>): KeyEvent {
  return { type: 'key', key: name, ctrl: false, alt: false, shift: false, ...mods };
}

function click(x: number, y: number): MouseEvent {
  return { type: 'mouse', action: 'press', button: 'left', x, y, ctrl: false, alt: false, shift: false };
}

function makeApp(): TuiApp {
  const t = createTuiTranslator(PLAIN_ENV);
  const app = createTuiApp({ t, daemonUrl: 'http://127.0.0.1:8137', now: () => 100_000 });
  app.applySnapshot(makeSnapshot());
  return app;
}

describe('app', () => {
  it('starts connecting, becomes ready on a snapshot, and stamps freshness', () => {
    const t = createTuiTranslator(PLAIN_ENV);
    const app = createTuiApp({ t, daemonUrl: 'http://127.0.0.1:8137', now: () => 42_000 });
    expect(app.state.phase).toBe('connecting');
    app.applySnapshot(makeSnapshot());
    expect(app.state.phase).toBe('ready');
    expect(app.state.lastSyncedAt).toBe(42_000);
  });

  it('arrows and jk move the selection; digits and Tab move pane focus', () => {
    const app = makeApp();
    expect(app.focus.focusedPane).toBe('workspaces');
    app.handleEvent(key('down'), SIZE);
    expect(app.selectedIndex('workspaces')).toBe(1);
    app.handleEvent(key('k'), SIZE);
    expect(app.selectedIndex('workspaces')).toBe(0);
    app.handleEvent(key('3'), SIZE);
    expect(app.focus.focusedPane).toBe('rules');
    app.handleEvent(key('tab'), SIZE);
    expect(app.focus.focusedPane).toBe('workspaces');
    app.handleEvent(key('tab', { shift: true }), SIZE);
    expect(app.focus.focusedPane).toBe('rules');
    app.handleEvent(key('G'), SIZE);
    expect(app.selectedIndex('rules')).toBe(2);
    app.handleEvent(key('g'), SIZE);
    expect(app.selectedIndex('rules')).toBe(0);
  });

  it('q and Ctrl+C quit at the dashboard root', () => {
    const app = makeApp();
    expect(app.handleEvent(key('q'), SIZE)).toEqual([{ type: 'quit' }]);
    expect(app.handleEvent(key('c', { ctrl: true }), SIZE)).toEqual([{ type: 'quit' }]);
  });

  it('/ captures printable keys into the pane filter; Enter locks, Esc clears', () => {
    const app = makeApp();
    app.handleEvent(key('3'), SIZE);
    app.handleEvent(key('/'), SIZE);
    for (const char of ['a', 'u', 't', 'h']) app.handleEvent(key(char), SIZE);
    expect(app.state.filter).toEqual({ pane: 'rules', query: 'auth', entering: true });
    expect(app.visibleRows('rules').map((row) => row.name)).toEqual(['auth-header-inject']);
    // While entering, q is a query character, not quit.
    expect(app.handleEvent(key('q'), SIZE)).toEqual([]);
    expect(app.state.filter?.query).toBe('authq');
    app.handleEvent(key('backspace'), SIZE);
    expect(app.state.filter?.query).toBe('auth');
    app.handleEvent(key('enter'), SIZE);
    expect(app.state.filter?.entering).toBe(false);
    app.handleEvent(key('escape'), SIZE);
    expect(app.state.filter).toBeNull();
  });

  it('Enter on a rule opens the drill-in and asks for the full definition', () => {
    const app = makeApp();
    app.handleEvent(key('3'), SIZE);
    const effects = app.handleEvent(key('enter'), SIZE);
    expect(effects).toEqual([{ type: 'fetch-rule', uid: 'rule-auth' }]);
    expect(app.state.detail).toMatchObject({ kind: 'rule', uid: 'rule-auth', data: null });
    app.handleEvent(key('escape'), SIZE);
    expect(app.state.detail).toBeNull();
  });

  it('Enter on an environment opens its drill-in; the No environment row does not', () => {
    const app = makeApp();
    app.handleEvent(key('2'), SIZE);
    app.handleEvent(key('enter'), SIZE);
    expect(app.state.detail).toMatchObject({ kind: 'env', uid: 'env-staging' });
    app.handleEvent(key('escape'), SIZE);
    app.handleEvent(key('G'), SIZE);
    app.handleEvent(key('enter'), SIZE);
    expect(app.state.detail).toBeNull();
  });

  it('workspace rows have no drill-in in v1 (switch is Phase 4)', () => {
    const app = makeApp();
    expect(app.handleEvent(key('enter'), SIZE)).toEqual([]);
    expect(app.state.detail).toBeNull();
  });

  it('y yanks the selected rule uid and confirms in the status bar', () => {
    const app = makeApp();
    app.handleEvent(key('3'), SIZE);
    const effects = app.handleEvent(key('y'), SIZE);
    expect(effects).toEqual([{ type: 'yank', text: 'rule-auth' }]);
    expect(app.state.notice?.text).toBe('uid copied to clipboard');
    // The notice expires on tick.
    expect(app.tick(200_000)).toBe(true);
    expect(app.state.notice).toBeNull();
  });

  it('r refreshes; in a rule drill-in it also refetches the rule', () => {
    const app = makeApp();
    expect(app.handleEvent(key('r'), SIZE)).toEqual([{ type: 'refresh' }]);
    app.handleEvent(key('3'), SIZE);
    app.handleEvent(key('enter'), SIZE);
    expect(app.handleEvent(key('r'), SIZE)).toEqual([{ type: 'refresh' }, { type: 'fetch-rule', uid: 'rule-auth' }]);
  });

  it('click focuses and selects; click on the selected row drills in', () => {
    const app = makeApp();
    // Rules pane body starts at x=33 (1 + left width 31 + border), row 3 is the second rule.
    app.handleEvent(click(40, 4), SIZE);
    expect(app.focus.focusedPane).toBe('rules');
    expect(app.selectedIndex('rules')).toBe(1);
    expect(app.state.detail).toBeNull();
    const effects = app.handleEvent(click(40, 4), SIZE);
    expect(effects).toEqual([{ type: 'fetch-rule', uid: 'rule-legacy' }]);
  });

  it('wheel moves the focused pane selection', () => {
    const app = makeApp();
    app.handleEvent(key('3'), SIZE);
    app.handleEvent(
      { type: 'mouse', action: 'wheel-down', button: 'none', x: 40, y: 5, ctrl: false, alt: false, shift: false },
      SIZE,
    );
    expect(app.selectedIndex('rules')).toBe(2);
  });

  it('unreachable parks without data and degrades with data; denial stops there', () => {
    const t = createTuiTranslator(PLAIN_ENV);
    const app = createTuiApp({ t, daemonUrl: 'http://127.0.0.1:8137', now: () => 100_000 });
    app.applyUnreachable('no daemon');
    expect(app.state.phase).toBe('parked');
    app.applySnapshot(makeSnapshot());
    app.applyUnreachable('no daemon');
    expect(app.state.phase).toBe('degraded');
    app.applyDenied('permission denied: read tools are disabled on this host');
    expect(app.state.phase).toBe('denied');
    expect(app.state.lastError).toContain('permission denied');
  });

  it('selection follows row identity across refreshes', () => {
    const app = makeApp();
    app.handleEvent(key('3'), SIZE);
    app.handleEvent(key('down'), SIZE);
    expect(app.selectedIndex('rules')).toBe(1);
    const reordered = makeSnapshot({
      rules: makeRulesPayload({
        rules: [
          { uid: 'rule-probe', name: 'rate-limit-probe', type: 'header', enabled: true, published: false },
          { uid: 'rule-legacy', name: 'legacy-token', type: 'header', enabled: false, published: true },
        ],
      }),
    });
    app.applySnapshot(reordered);
    expect(app.selectedIndex('rules')).toBe(1);
    expect(app.visibleRows('rules')[app.selectedIndex('rules')].identity).toBe('rule-legacy');
  });

  it('an environment drill-in closes when its environment disappears on refresh', () => {
    const app = makeApp();
    app.handleEvent(key('2'), SIZE);
    app.handleEvent(key('enter'), SIZE);
    expect(app.state.detail).toMatchObject({ kind: 'env' });
    const snapshot = makeSnapshot();
    snapshot.environments.environments.splice(0, 1);
    app.applySnapshot(snapshot);
    expect(app.state.detail).toBeNull();
  });
});
