/**
 * Trusted Certificates navigator entry — the singleton opener row
 * beside Vault in the Variables view. Pins the row id the sidebar's
 * selection + scroll code keys on and that opening it fires the
 * editor opener.
 */

import { useVariableSingletonNodes } from '@openheaders/ui/workbench/components/sidebar/useVariableSingletonNodes';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

describe('useVariableSingletonNodes — trusted roots', () => {
  it('exposes the trusted-roots-row opener beside the vault row', () => {
    const onOpenTrustedRoots = vi.fn();
    const { result } = renderHook(() => useVariableSingletonNodes({ onOpenTrustedRoots }));
    const node = result.current.trustedRootsNode;
    expect(node.id).toBe('trusted-roots-row');
    expect(node.kind).toBe('leaf');
    expect(node.label).toBe('Trusted Certificates');
    expect(node.canDelete).toBe(false);
    expect(node.canRename).toBe(false);
    node.onOpen?.();
    expect(onOpenTrustedRoots).toHaveBeenCalledTimes(1);
    expect(result.current.vaultNode.id).toBe('vault-row');
  });
});
