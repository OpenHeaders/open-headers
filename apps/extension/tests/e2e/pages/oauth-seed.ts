/**
 * The auth-type suite's OAuth 2.0 token-store seed — one channel call
 * per oauth2 credential the suite's requests read, through the SW's
 * real flows against the playground IdP. A device-grant seed answers
 * pending (the SW polls the rig on its own timer); the seed then
 * awaits its grant on `oauthDeviceStatus` so every case sends against
 * a stored bundle.
 */

import { expect } from '@playwright/test';
import { AUTH_SUITE_OAUTH_SEEDS } from '../../../../../playground/scripts/auth-type-suite';

export type SuiteRpc = <T = unknown>(type: string, payload?: Record<string, unknown>) => Promise<T>;

export async function seedOAuthSuite(rpc: SuiteRpc): Promise<void> {
  for (const { channel, config } of AUTH_SUITE_OAUTH_SEEDS) {
    const seed = await rpc<{ success: boolean; error?: string }>(channel, { config });
    expect(seed.success, `${channel} ${config.credentialRef}: ${seed.error ?? ''}`).toBe(true);
  }
  for (const { channel, config } of AUTH_SUITE_OAUTH_SEEDS) {
    if (channel !== 'oauthDeviceStart') continue;
    await expect
      .poll(
        async () => {
          const status = await rpc<{ state: { state: string; message?: string } | null }>('oauthDeviceStatus', {
            credentialRef: config.credentialRef,
          });
          return status.state === null ? 'cleared' : `${status.state.state}${status.state.message ?? ''}`;
        },
        { timeout: 15000, message: `device grant for ${config.credentialRef}` },
      )
      .toBe('granted');
  }
}
