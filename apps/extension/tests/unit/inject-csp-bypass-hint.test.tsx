/**
 * Degraded-bypassCSP hint capability gate.
 *
 * The rule editor's Bypass CSP checkbox is never gated — execution
 * degrades gracefully — but when the host reports the user-scripts
 * privilege is off (`cspExemptInjection` → false), an inline hint says
 * only header CSP is covered and names the browser toggle that
 * restores `<meta>` CSP coverage. Capability absent (desktop,
 * Firefox / Safari — no such toggle) or true (privilege granted):
 * nothing renders, no false warning.
 */

import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import CspBypassHint from '@openheaders/ui/workbench/components/rule-fields/CspBypassHint';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

const HINT_PATTERN = /Covers header CSP only/;

afterEach(() => {
  cleanup();
  unregisterCapability('cspExemptInjection');
});

describe('CspBypassHint capability gate', () => {
  it('renders nothing when the capability is absent', () => {
    render(<CspBypassHint />);
    expect(screen.queryByText(HINT_PATTERN)).toBeNull();
  });

  it('renders nothing when the privilege is granted', async () => {
    registerCapability('cspExemptInjection', () => Promise.resolve(true));
    render(<CspBypassHint />);
    await waitFor(() => expect(screen.queryByText(HINT_PATTERN)).toBeNull());
  });

  it('renders the degraded-coverage hint when the privilege is off', async () => {
    registerCapability('cspExemptInjection', () => Promise.resolve(false));
    render(<CspBypassHint />);
    expect(await screen.findByText(HINT_PATTERN)).toBeTruthy();
  });
});
