import { describe, expect, it } from 'vitest';

import { cdpBlockedReasonLabel } from '../../src/correlator-cdp/blocked-reason';

describe('cdpBlockedReasonLabel', () => {
  it('passes through the exact reason words the panel renders verbatim', () => {
    expect(cdpBlockedReasonLabel('csp')).toBe('csp');
    expect(cdpBlockedReasonLabel('mixed-content')).toBe('mixed-content');
    expect(cdpBlockedReasonLabel('origin')).toBe('origin');
    expect(cdpBlockedReasonLabel('inspector')).toBe('inspector');
    expect(cdpBlockedReasonLabel('subresource-filter')).toBe('subresource-filter');
    expect(cdpBlockedReasonLabel('content-type')).toBe('content-type');
    expect(cdpBlockedReasonLabel('other')).toBe('other');
  });

  it('folds the cross-origin-policy variants to their family word', () => {
    expect(cdpBlockedReasonLabel('coep-frame-resource-needs-coep-header')).toBe('coep');
    expect(cdpBlockedReasonLabel('coop-sandboxed-iframe-cannot-navigate-to-coop-page')).toBe('coop');
    expect(cdpBlockedReasonLabel('corp-not-same-origin')).toBe('corp');
    expect(cdpBlockedReasonLabel('corp-not-same-site')).toBe('corp');
    expect(cdpBlockedReasonLabel('corp-not-same-origin-after-defaulted-to-same-origin-by-coep')).toBe('corp');
  });

  it('maps an unrecognized reason to the catch-all word', () => {
    expect(cdpBlockedReasonLabel('some-future-reason')).toBe('other');
  });

  it('returns undefined for an absent or empty reason', () => {
    expect(cdpBlockedReasonLabel(undefined)).toBeUndefined();
    expect(cdpBlockedReasonLabel('')).toBeUndefined();
  });
});
