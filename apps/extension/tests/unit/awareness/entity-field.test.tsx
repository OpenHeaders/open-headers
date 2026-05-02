/**
 * `<EntityField>` — focus dispatch + scope inheritance + chip suppression.
 *
 * The wrapper's contract:
 *   - Reads `(entityType, entityId)` from the surrounding `EntityScope`
 *     when no override props are passed.
 *   - Override props take precedence (sidebar rows + breadcrumb pattern).
 *   - On focus capture, dispatches `{entityType, entityId, path}` to the
 *     `ActiveFieldFocus` setter.
 *   - On blur capture (when focus leaves the wrapper), clears focus.
 *   - Renders a presence chip when entity is known and chip not hidden.
 */

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => cleanup());

vi.mock('@/shared/awareness/IdentityContext', () => ({
  useLocalInstanceId: () => 'test-instance-1',
  useSurfaceIdentity: () => ({ current: () => null }),
}));

vi.mock('@/shared/awareness/use-entity-presence', () => ({
  useFieldPresence: () => [],
  useEntityPresence: () => [],
}));

import { ActiveFieldFocusProvider, useActiveFieldFocus } from '@/shared/awareness/ActiveFieldFocus';
import { EntityField } from '@/shared/awareness/EntityField';
import { EntityScopeProvider } from '@/shared/awareness/EntityScope';

function FocusReader({ onFocus }: { onFocus: (focus: ReturnType<typeof useActiveFieldFocus>) => void }) {
  const focus = useActiveFieldFocus();
  onFocus(focus);
  return null;
}

describe('EntityField — scope resolution', () => {
  it('inherits entityType + entityId from EntityScopeProvider when no override', () => {
    let captured: ReturnType<typeof useActiveFieldFocus> = null;
    const { getByTestId } = render(
      <ActiveFieldFocusProvider>
        <EntityScopeProvider entityType="rule" entityId="rule-1">
          <EntityField path="name">
            <input data-testid="ef-input" />
          </EntityField>
        </EntityScopeProvider>
        <FocusReader onFocus={(f) => (captured = f)} />
      </ActiveFieldFocusProvider>,
    );
    act(() => {
      getByTestId('ef-input').focus();
    });
    expect(captured).toEqual({ entityType: 'rule', entityId: 'rule-1', path: 'name' });
  });

  it('override props take precedence over EntityScope context', () => {
    let captured: ReturnType<typeof useActiveFieldFocus> = null;
    const { getByTestId } = render(
      <ActiveFieldFocusProvider>
        <EntityScopeProvider entityType="rule" entityId="rule-context">
          <EntityField entityType="request" entityId="req-override" path="name">
            <input data-testid="ef-input" />
          </EntityField>
        </EntityScopeProvider>
        <FocusReader onFocus={(f) => (captured = f)} />
      </ActiveFieldFocusProvider>,
    );
    act(() => {
      getByTestId('ef-input').focus();
    });
    expect(captured).toEqual({ entityType: 'request', entityId: 'req-override', path: 'name' });
  });

  it('skips publish when entityId is null (unsaved draft)', () => {
    let captured: ReturnType<typeof useActiveFieldFocus> = null;
    const { getByTestId } = render(
      <ActiveFieldFocusProvider>
        <EntityScopeProvider entityType="rule" entityId={null}>
          <EntityField path="name">
            <input data-testid="ef-input" />
          </EntityField>
        </EntityScopeProvider>
        <FocusReader onFocus={(f) => (captured = f)} />
      </ActiveFieldFocusProvider>,
    );
    act(() => {
      getByTestId('ef-input').focus();
    });
    expect(captured).toBeNull();
  });
});

describe('EntityField — blur lifecycle', () => {
  it('clears focus when blur leaves the wrapper', () => {
    let captured: ReturnType<typeof useActiveFieldFocus> = null;
    const { getByTestId } = render(
      <ActiveFieldFocusProvider>
        <EntityScopeProvider entityType="rule" entityId="rule-1">
          <EntityField path="name">
            <input data-testid="inside" />
          </EntityField>
          <input data-testid="outside" />
        </EntityScopeProvider>
        <FocusReader onFocus={(f) => (captured = f)} />
      </ActiveFieldFocusProvider>,
    );
    act(() => {
      getByTestId('inside').focus();
    });
    expect(captured).toEqual({ entityType: 'rule', entityId: 'rule-1', path: 'name' });
    act(() => {
      getByTestId('outside').focus();
    });
    expect(captured).toBeNull();
  });
});
