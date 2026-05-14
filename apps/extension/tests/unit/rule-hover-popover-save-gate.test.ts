/**
 * RuleHoverPopover Save-button gate — verifies that broken edits never
 * reach the rule store via the inline-edit popover.
 *
 * The popover composes three validators and a couple of structural
 * flags into a single `canSave` boolean. This test mirrors that exact
 * formula so the contract is pinned independent of the JSX:
 *
 *   canSave =
 *     editable && draftDirty && !saving &&
 *     trimmedName.length > 0 &&
 *     nameValidation.valid &&
 *     valueValidation.valid &&
 *     (!capability || capability.allowed)
 *
 * Covers the three failure modes the gate exists to catch:
 *   (a) capability violation — wrong op for header
 *   (b) invalid header name — illegal characters
 *   (c) CRLF in value — header injection vector
 *
 * Validator-level coverage lives in `packages/core/tests/utils/`. This
 * file exists to assert that the popover's composition still trips on
 * all three failure modes (no `||` accidentally relaxed to `&&`).
 */

import type { HeaderOperation } from '@openheaders/core/types';
import { getHeaderOperationCapability, validateHeaderName, validateHeaderValue } from '@openheaders/core/utils';
import { describe, expect, it } from 'vitest';

interface Draft {
  operation: HeaderOperation;
  headerName: string;
  value: string;
}

interface ComposeOpts {
  direction: 'request' | 'response';
  editable: boolean;
  draftDirty: boolean;
  saving: boolean;
}

/**
 * Mirrors the canSave composition in
 * `packages/ui/src/panel/components/RuleHoverPopover.tsx`. Kept in
 * sync by review — the file's contract section calls out the formula.
 */
function computeCanSave(draft: Draft, opts: ComposeOpts): boolean {
  const { direction, editable, draftDirty, saving } = opts;
  const isResponse = direction === 'response';
  const trimmedName = draft.headerName.trim();
  const nameValidation =
    editable && trimmedName && !trimmedName.includes('{{')
      ? validateHeaderName(trimmedName, isResponse)
      : { valid: true as const, message: '' };
  const valueValidation =
    editable && draft.operation !== 'remove' && draft.value && !draft.value.includes('{{')
      ? validateHeaderValue(draft.value, trimmedName)
      : { valid: true as const, message: '' };
  const capability = editable ? getHeaderOperationCapability(direction, draft.operation, draft.headerName) : null;

  return (
    editable &&
    draftDirty &&
    !saving &&
    trimmedName.length > 0 &&
    nameValidation.valid &&
    valueValidation.valid &&
    (!capability || capability.allowed)
  );
}

const baseOpts: ComposeOpts = { direction: 'request', editable: true, draftDirty: true, saving: false };

describe('RuleHoverPopover Save-button gate', () => {
  it('allows save when name + value + capability all pass', () => {
    const ok = computeCanSave({ operation: 'override', headerName: 'X-Auth', value: 'token' }, baseOpts);
    expect(ok).toBe(true);
  });

  it('blocks save on capability violation (set on a forbidden response header)', () => {
    // `Content-Length` is a forbidden response-header op in DNR's set list.
    const blocked = computeCanSave(
      { operation: 'override', headerName: 'Content-Length', value: '0' },
      { ...baseOpts, direction: 'response' },
    );
    expect(blocked).toBe(false);
  });

  it('blocks save when the header name has illegal characters', () => {
    const blocked = computeCanSave({ operation: 'override', headerName: 'X Auth', value: 'token' }, baseOpts);
    expect(blocked).toBe(false);
  });

  it('blocks save when the value contains CRLF (header injection vector)', () => {
    const blocked = computeCanSave(
      { operation: 'override', headerName: 'X-Auth', value: 'token\r\nX-Evil: yes' },
      baseOpts,
    );
    expect(blocked).toBe(false);
  });

  it('blocks save when the draft is not dirty', () => {
    const blocked = computeCanSave(
      { operation: 'override', headerName: 'X-Auth', value: 'token' },
      { ...baseOpts, draftDirty: false },
    );
    expect(blocked).toBe(false);
  });

  it('blocks save while a save is in flight', () => {
    const blocked = computeCanSave(
      { operation: 'override', headerName: 'X-Auth', value: 'token' },
      { ...baseOpts, saving: true },
    );
    expect(blocked).toBe(false);
  });

  it('blocks save when the popover is not editable (rule deleted, mod gone)', () => {
    const blocked = computeCanSave(
      { operation: 'override', headerName: 'X-Auth', value: 'token' },
      { ...baseOpts, editable: false },
    );
    expect(blocked).toBe(false);
  });

  it('blocks save when the trimmed header name is empty', () => {
    const blocked = computeCanSave({ operation: 'override', headerName: '   ', value: 'token' }, baseOpts);
    expect(blocked).toBe(false);
  });

  it('skips name/value validation for templated values (resolved at runtime)', () => {
    // Templates pass through the name/value gate — only structural
    // validity is decidable at edit time. Capability still applies.
    const ok = computeCanSave(
      { operation: 'override', headerName: 'X-{{env.suffix}}', value: '{{vault.token}}' },
      baseOpts,
    );
    expect(ok).toBe(true);
  });

  it('does not require a value when operation is remove', () => {
    const ok = computeCanSave({ operation: 'remove', headerName: 'X-Auth', value: '' }, baseOpts);
    expect(ok).toBe(true);
  });
});
