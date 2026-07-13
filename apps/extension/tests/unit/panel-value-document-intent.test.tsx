/**
 * Value-document intent seam — registration must be loop-proof.
 *
 * The registered opener is provider STATE: writing it re-renders every
 * context consumer. A registration keyed on the caller's function identity
 * turns an identity-unstable caller (one new function per render) into a
 * self-sustaining render → cleanup → setOpener → render loop — React #185
 * white-screened the live panel exactly this way. The hook therefore
 * registers a stable trampoline once and routes calls to the LATEST
 * function through a ref.
 */

import {
  type RuleValueDocumentTarget,
  useOpenValueDocument,
  useRegisterValueDocumentOpener,
  ValueDocumentIntentProvider,
} from '@openheaders/ui/panel/data/value-document-intent';
import { act, render } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

const TARGET: RuleValueDocumentTarget = {
  ruleUid: 'rule-1',
  direction: 'request',
  modUid: 'mod-1',
  headerName: 'X-OpenHeaders',
} as RuleValueDocumentTarget;

describe('useRegisterValueDocumentOpener', () => {
  it('an identity-unstable opener does not loop the provider (and calls route to the latest)', () => {
    const calls: string[] = [];
    let openerRenders = 0;
    let rerenderOwner: () => void = () => {};

    function Owner() {
      // A NEW function identity every render — the shape that looped live.
      const [, bump] = useState(0);
      rerenderOwner = () => bump((n) => n + 1);
      const seq = `owner-${++openerRenders}`;
      useRegisterValueDocumentOpener(() => calls.push(seq));
      return <Caller />;
    }

    function Caller() {
      const open = useOpenValueDocument();
      return (
        <button type="button" data-testid="open" disabled={open === null} onClick={() => open?.(TARGET)}>
          open
        </button>
      );
    }

    const { getByTestId } = render(
      <ValueDocumentIntentProvider>
        <Owner />
      </ValueDocumentIntentProvider>,
    );

    // Re-render the owner several times with fresh opener identities: the
    // registration must not write provider state again (a write would loop
    // when the owner also consumes the context).
    const before = openerRenders;
    act(() => rerenderOwner());
    act(() => rerenderOwner());
    act(() => rerenderOwner());
    // Each bump renders the owner once — no context-feedback extra renders.
    expect(openerRenders).toBe(before + 3);

    // The registered trampoline dispatches to the LATEST opener.
    act(() => getByTestId('open').click());
    expect(calls).toEqual([`owner-${openerRenders}`]);
  });

  it('renders without a provider are inert (no opener, no crash)', () => {
    const spy = vi.fn();
    function Bare() {
      useRegisterValueDocumentOpener(spy);
      return <span>{String(useOpenValueDocument() === null)}</span>;
    }
    const { container } = render(<Bare />);
    expect(container.textContent).toBe('true');
    expect(spy).not.toHaveBeenCalled();
  });
});
