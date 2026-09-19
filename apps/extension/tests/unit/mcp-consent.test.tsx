/**
 * Shared enable-MCP consent gesture — `mcp-consent`.
 *
 * Pins the one home both ambient-chrome surfaces flip `mcp.enabled`
 * through (the Add-ons popover's MCP row and the terminal's TUI-gate
 * checkbox):
 *   - `enableMcp` writes the master switch on;
 *   - `mcpEndpointInfo` serves the shared endpoint explainer and
 *     appends a surface-specific rider sentence when given one;
 *   - `confirmEnableMcp` flips ONLY on OK — Cancel leaves the switch
 *     off (the consent moment is real, not decoration).
 */

import '@openheaders/ui/workbench/settings/schema';

import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { setCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import { confirmEnableMcp, enableMcp, mcpEndpointInfo } from '@openheaders/ui/workbench/settings/mcp-consent';
import { get, set } from '@openheaders/ui/workbench/settings/store';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App as AntApp } from 'antd';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const t: Translate = (key) => key;

/** Mounts inside <AntApp> and opens the consent dialog once. */
const OpenDialogOnce: React.FC = () => {
  const { modal } = AntApp.useApp();
  useEffect(() => {
    confirmEnableMcp(modal, t);
  }, [modal]);
  return null;
};

beforeEach(() => {
  setCurrentHost('desktop');
  set('mcp.enabled', false);
});

// Unmount inside act so the dialog's close motion and React's queued
// work settle before the file's window is torn down.
afterEach(cleanup);

describe('mcp-consent', () => {
  it('enableMcp flips the master switch on', () => {
    expect(get('mcp.enabled')).toBe(false);
    enableMcp();
    expect(get('mcp.enabled')).toBe(true);
  });

  it('mcpEndpointInfo serves the shared explainer and appends a rider when given', () => {
    const bare = mcpEndpointInfo(t);
    expect(bare.title).toBe('workbench.settings.mcpConsent.info.title');
    expect(bare.summary).toBe('workbench.settings.mcpConsent.info.summary');
    const ridden = mcpEndpointInfo(t, 'rider-sentence');
    expect(ridden.summary).toBe('workbench.settings.mcpConsent.info.summary rider-sentence');
  });

  it('confirmEnableMcp flips the switch on OK', async () => {
    render(
      <AntApp>
        <OpenDialogOnce />
      </AntApp>,
    );
    const ok = await screen.findByRole('button', { name: 'workbench.settings.mcpConsent.ok' });
    fireEvent.click(ok);
    await waitFor(() => expect(get('mcp.enabled')).toBe(true));
  });

  it('confirmEnableMcp leaves the switch off on Cancel', async () => {
    render(
      <AntApp>
        <OpenDialogOnce />
      </AntApp>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(get('mcp.enabled')).toBe(false));
  });
});
