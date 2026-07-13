// @vitest-environment jsdom
/**
 * QuickConditionsRow — the quick-editor popovers' conditions row.
 * Collapsed: a one-line digest of the ACTUAL condition list. Expanded:
 * the workbench ConditionEditor bound to the same array, so edits
 * round-trip through `onChange` exactly as the Rule Editor would emit
 * them.
 */

import type { RuleCondition } from '@openheaders/core/types';
import { DEFAULT_LOCALE, getTranslator } from '@openheaders/i18n';
import {
  QuickConditionsRow,
  summarizeConditions,
} from '@openheaders/ui/panel/components/rule-quick-editor/QuickConditionsRow';
import { AwarenessIdentityProvider } from '@openheaders/ui/shared/awareness';
import { DocsNavProvider } from '@openheaders/ui/shared/docs/use-docs-nav';
// Side-effect import — ConditionEditor's TemplateInputs read workbench
// settings via useSyncExternalStore.
import '@openheaders/ui/workbench/settings/schema';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { resolveWorkbenchIdentity } from '@/host/surface-identity-resolvers';

const testIdentity = resolveWorkbenchIdentity();
const t = getTranslator(DEFAULT_LOCALE);

beforeAll(() => {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  const scope = globalThis as unknown as { ResizeObserver?: typeof ResizeObserver };
  if (typeof scope.ResizeObserver === 'undefined') {
    scope.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  }
});

afterEach(cleanup);

const CONDITIONS: RuleCondition[] = [
  { uid: 'c1', type: 'url-filter', values: ['*://api.openheaders.io/*'] },
  { uid: 'c2', type: 'request-methods', values: ['GET', 'POST'] },
];

function renderRow(value: RuleCondition[], onChange = vi.fn()) {
  const utils = render(
    <AwarenessIdentityProvider value={testIdentity}>
      <DocsNavProvider>
        <QuickConditionsRow value={value} onChange={onChange} />
      </DocsNavProvider>
    </AwarenessIdentityProvider>,
  );
  return { ...utils, onChange };
}

describe('summarizeConditions', () => {
  it('digests each row as "<type label> <values>"', () => {
    expect(summarizeConditions(CONDITIONS, t)).toBe('URL Pattern *://api.openheaders.io/* · Methods GET, POST');
  });

  it('renders the domain-type enum by its display label', () => {
    expect(summarizeConditions([{ uid: 'c1', type: 'domain-type', values: ['thirdParty'] }], t)).toBe(
      'Domain Type Third-party',
    );
  });

  it('includes the header name on per-header rows', () => {
    expect(
      summarizeConditions([{ uid: 'c1', type: 'response-header', headerName: 'content-type', values: ['json'] }], t),
    ).toBe('Response Header content-type: json');
  });

  it('states the matches-nothing consequence for an empty list', () => {
    expect(summarizeConditions([], t)).toBe('none — matches no requests');
  });
});

describe('QuickConditionsRow', () => {
  it('renders collapsed: summary visible, editor absent', () => {
    const { getByText, queryByText } = renderRow(CONDITIONS);
    expect(getByText('URL Pattern *://api.openheaders.io/* · Methods GET, POST')).toBeTruthy();
    expect(queryByText('Add condition')).toBeNull();
  });

  it('expands to the workbench ConditionEditor on click', () => {
    const { getByTitle, getByText, getAllByRole, container } = renderRow(CONDITIONS);
    fireEvent.click(getByTitle('Show and edit when this rule fires'));
    expect(getByText('Add condition')).toBeTruthy();
    // One row per condition: the type selects and the methods
    // multi-select expose combobox inputs; the url-filter row renders
    // its pattern in a TemplateInput editable.
    expect(getAllByRole('combobox').length).toBeGreaterThanOrEqual(3);
    const editable = container.querySelector('.oh-template-input-editable');
    expect(editable?.textContent).toContain('*://api.openheaders.io/*');
  });

  it('round-trips edits through onChange (add appends a row)', () => {
    const { getByTitle, getByText, onChange } = renderRow(CONDITIONS);
    fireEvent.click(getByTitle('Show and edit when this rule fires'));
    fireEvent.click(getByText('Add condition'));
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as RuleCondition[];
    expect(next).toHaveLength(3);
    expect(next.slice(0, 2)).toEqual(CONDITIONS);
    expect(next[2].uid).toBeTruthy();
  });

  it('round-trips row deletion through onChange', () => {
    const { getByTitle, container, onChange } = renderRow(CONDITIONS);
    fireEvent.click(getByTitle('Show and edit when this rule fires'));
    const deleteButtons = container.querySelectorAll('.anticon-close');
    expect(deleteButtons.length).toBeGreaterThan(0);
    fireEvent.click(deleteButtons[0] as Element);
    expect(onChange).toHaveBeenCalledWith([CONDITIONS[1]]);
  });
});
