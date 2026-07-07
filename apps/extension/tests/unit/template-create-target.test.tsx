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

import { detectCreateTarget } from '@openheaders/ui/workbench/components/template-input/create-target';
import SuggestionPopover from '@openheaders/ui/workbench/components/template-input/SuggestionPopover';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

describe('detectCreateTarget', () => {
  it('targets the namespace of a creatable scoped reference', () => {
    expect(detectCreateTarget('vault.okay', undefined)).toEqual({
      reference: 'vault.okay',
      name: 'okay',
      scopeLabel: 'Vault',
    });
    expect(detectCreateTarget('workspace.whatever', undefined)).toEqual({
      reference: 'workspace.whatever',
      name: 'whatever',
      scopeLabel: 'Workspace',
    });
  });

  it('offers a bare reference with the scope left to the Add-to picker', () => {
    expect(detectCreateTarget('whatever', undefined)).toEqual({
      reference: 'whatever',
      name: 'whatever',
      scopeLabel: null,
    });
  });

  it('needs an active collection for collection-scoped refs', () => {
    expect(detectCreateTarget('collection.token', undefined)).toBeNull();
    expect(detectCreateTarget('collection.token', 'col-1')).toEqual({
      reference: 'collection.token',
      name: 'token',
      scopeLabel: 'Collection',
    });
  });

  it('rejects non-creatable namespaces, unknown namespaces, and empty refs', () => {
    expect(detectCreateTarget('dynamic.uuid', undefined)).toBeNull();
    expect(detectCreateTarget('foo.x', undefined)).toBeNull();
    expect(detectCreateTarget('', undefined)).toBeNull();
    expect(detectCreateTarget('env.', undefined)).toBeNull();
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
