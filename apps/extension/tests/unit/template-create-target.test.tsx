// @vitest-environment jsdom
/**
 * Suggestion-popover create flow — target detection + empty-state UX.
 *
 * A reference that matches nothing offers a create action: scoped refs
 * (`vault.okay`) target their namespace, bare refs (`whatever`) defer
 * the scope to the create popover's "Add to" picker. The popover shows
 * the "No matches" empty state ABOVE the create row so the user sees
 * why a create is being offered.
 */

import { DEFAULT_LOCALE, getTranslator } from '@openheaders/i18n';
import { detectCreateTarget } from '@openheaders/ui/workbench/components/template-input/create-target';
import SuggestionPopover from '@openheaders/ui/workbench/components/template-input/SuggestionPopover';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

const t = getTranslator(DEFAULT_LOCALE);

describe('detectCreateTarget', () => {
  it('targets the namespace of a creatable scoped reference', () => {
    expect(detectCreateTarget('vault.okay', undefined, t)).toEqual({
      reference: 'vault.okay',
      name: 'okay',
      scopeLabel: 'Vault',
    });
    expect(detectCreateTarget('workspace.whatever', undefined, t)).toEqual({
      reference: 'workspace.whatever',
      name: 'whatever',
      scopeLabel: 'Workspace',
    });
  });

  it('offers a bare reference with the scope left to the Add-to picker', () => {
    expect(detectCreateTarget('whatever', undefined, t)).toEqual({
      reference: 'whatever',
      name: 'whatever',
      scopeLabel: null,
    });
  });

  it('needs an active collection for collection-scoped refs', () => {
    expect(detectCreateTarget('collection.token', undefined, t)).toBeNull();
    expect(detectCreateTarget('collection.token', 'col-1', t)).toEqual({
      reference: 'collection.token',
      name: 'token',
      scopeLabel: 'Collection',
    });
  });

  it('rejects non-creatable namespaces, unknown namespaces, and empty refs', () => {
    expect(detectCreateTarget('dynamic.uuid', undefined, t)).toBeNull();
    expect(detectCreateTarget('foo.x', undefined, t)).toBeNull();
    expect(detectCreateTarget('', undefined, t)).toBeNull();
    expect(detectCreateTarget('env.', undefined, t)).toBeNull();
  });
});

describe('SuggestionPopover empty state + create action', () => {
  it('shows "No matches" above the create row', () => {
    const onSelect = vi.fn();
    const { getByText } = render(
      <SuggestionPopover
        suggestions={[]}
        activeIndex={0}
        onActiveIndexChange={() => {}}
        onSelect={() => {}}
        createAction={{ label: 'Create “whatever” variable', onSelect }}
      />,
    );
    const empty = getByText('No matches');
    const create = getByText('Create “whatever” variable');
    expect(empty).toBeTruthy();
    // Empty state precedes the create row in document order.
    expect(empty.compareDocumentPosition(create) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(create);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('shows only "No matches" when nothing is creatable', () => {
    const { getByText, queryByRole } = render(
      <SuggestionPopover suggestions={[]} activeIndex={0} onActiveIndexChange={() => {}} onSelect={() => {}} />,
    );
    expect(getByText('No matches')).toBeTruthy();
    expect(queryByRole('option')).toBeNull();
  });
});
