/**
 * The two trust scopes composed into one `ca` list: workspace roots
 * first, device pins after; absent when both are empty so the
 * transport's default trust path stays byte-identical.
 */

import { describe, expect, it, vi } from 'vitest';
import { getTrustAnchorsForSend } from '../../src/live/trust-anchors';

const ROOT = '-----BEGIN CERTIFICATE-----\nROOT\n-----END CERTIFICATE-----\n';
const PIN = '-----BEGIN CERTIFICATE-----\nPIN\n-----END CERTIFICATE-----\n';

const workspaceRoots = vi.fn<(workspaceId: string) => string[]>(() => []);
const devicePems = vi.fn<() => string[]>(() => []);
vi.mock('../../src/entity/trusted-roots-store', () => ({
  getTrustedRootPemsForWorkspace: (workspaceId: string) => workspaceRoots(workspaceId),
}));
vi.mock('../../src/entity/device-trust-store', () => ({
  getDeviceTrustPems: () => devicePems(),
}));

describe('getTrustAnchorsForSend', () => {
  it('is absent when neither scope holds a certificate', () => {
    expect(getTrustAnchorsForSend('ws-1')).toBeUndefined();
    expect(getTrustAnchorsForSend(null)).toBeUndefined();
  });

  it('composes workspace roots before device pins and counts each scope', () => {
    workspaceRoots.mockImplementation((workspaceId) => (workspaceId === 'ws-1' ? [ROOT] : []));
    devicePems.mockReturnValue([PIN]);
    expect(getTrustAnchorsForSend('ws-1')).toEqual({ pems: [ROOT, PIN], workspace: 1, device: 1 });
    expect(getTrustAnchorsForSend('ws-other')).toEqual({ pems: [PIN], workspace: 0, device: 1 });
    // No workspace at all still dials with this device's pins.
    expect(getTrustAnchorsForSend(null)).toEqual({ pems: [PIN], workspace: 0, device: 1 });
  });
});
