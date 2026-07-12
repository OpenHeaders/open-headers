/**
 * LocaleProvider — the translation plane's React seam.
 *
 * Pins the Phase A i18n contract:
 *   - `useT()` translates through the English catalog by default, with
 *     or without a mounted provider;
 *   - switching `general.language` to pseudo swaps the catalog in
 *     place — no remount, no reload;
 *   - the resolved locale + direction land on the document element,
 *     with pseudo announced as English;
 *   - the language picker's options derive from the i18n locale
 *     registry via the settings registry.
 */

import { PSEUDO_LOCALE } from '@openheaders/i18n';
import { LocaleProvider, useT } from '@openheaders/ui/context';
import { getDef } from '@openheaders/ui/workbench/settings/registry';
import { set as setSettingValue } from '@openheaders/ui/workbench/settings/store';
import '@openheaders/ui/workbench/settings/schema';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

function SaveLabel(): React.JSX.Element {
  const t = useT();
  return <span data-testid="save-label">{t('shared.action.save')}</span>;
}

afterEach(() => {
  cleanup();
  act(() => setSettingValue('general.language', 'auto'));
});

describe('LocaleProvider', () => {
  it('renders English through the default (auto) locale', () => {
    render(
      <LocaleProvider>
        <SaveLabel />
      </LocaleProvider>,
    );
    expect(screen.getByTestId('save-label').textContent).toBe('Save');
  });

  it('swaps to the pseudo catalog in place when the setting changes', () => {
    render(
      <LocaleProvider>
        <SaveLabel />
      </LocaleProvider>,
    );
    act(() => setSettingValue('general.language', PSEUDO_LOCALE));
    const label = screen.getByTestId('save-label').textContent ?? '';
    expect(label.startsWith('⟦')).toBe(true);
    expect(label).not.toContain('Save');
  });

  it('mirrors locale + direction onto the document, announcing pseudo as English', () => {
    render(
      <LocaleProvider>
        <SaveLabel />
      </LocaleProvider>,
    );
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
    act(() => setSettingValue('general.language', PSEUDO_LOCALE));
    expect(document.documentElement.lang).toBe('en');
  });

  it('translates through the English catalog without a provider', () => {
    render(<SaveLabel />);
    expect(screen.getByTestId('save-label').textContent).toBe('Save');
  });
});

describe('general.language registration', () => {
  it('derives its options from the i18n locale registry', () => {
    const def = getDef('general.language');
    expect(def).toBeDefined();
    const values = def?.enumOptions?.map((o) => o.value) ?? [];
    expect(values[0]).toBe('auto');
    expect(values).toContain('en');
    expect(values).toContain(PSEUDO_LOCALE);
  });
});
