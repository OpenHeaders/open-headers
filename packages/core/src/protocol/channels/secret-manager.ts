/**
 * Secret-manager bridge RPCs — this device's connections to external
 * secret managers (the Secret Providers plan): the list, add / update /
 * remove, the side-effect-free probe behind every status chip, and the
 * interactive authorization behind the settings list's Test gesture.
 * Node-host answered on the device that resolves (the desktop app's
 * main process; the daemon for its headless lanes); browser surfaces
 * reach the desktop's connections over loopback in a later slice and
 * self-gate on the request runtime until then.
 */

import type { SecretAuthorizeResult, SecretProviderProbe } from '../../secret-providers/types';
import type { SecretManagerConnection, SecretManagerConnectionConfig } from '../../types';

export interface SecretManagerRpc {
  /** Every connection on this device, in creation order. */
  'oh.secretManager.list': {
    req: Record<string, never>;
    res: { connections: SecretManagerConnection[] };
  };
  /** Add one connection; echoes the minted row. A blank label takes the config's own description. */
  'oh.secretManager.add': {
    req: { label: string; config: SecretManagerConnectionConfig };
    res: { ok: true; connection: SecretManagerConnection } | { ok: false; error: string };
  };
  /** Replace a connection's label and config in place; the uid (and every reference to it) stands. */
  'oh.secretManager.update': {
    req: { uid: string; label: string; config: SecretManagerConnectionConfig };
    res: { ok: true; connection: SecretManagerConnection } | { ok: false; error: string };
  };
  'oh.secretManager.remove': {
    req: { uid: string };
    res: { ok: true } | { ok: false; error: string };
  };
  /**
   * The connection's standing on this device — side-effect free, never
   * prompts. `unavailable` with `not-installed` when no provider for
   * its kind is installed here.
   */
  'oh.secretManager.probe': {
    req: { uid: string };
    res: SecretProviderProbe;
  };
  /**
   * The connection's interactive authorization — the provider's own
   * prompt appears on this device. The one call that may prompt.
   */
  'oh.secretManager.authorize': {
    req: { uid: string };
    res: SecretAuthorizeResult;
  };
}
