/**
 * The desktop app's `onepassword` secret provider — the flagship
 * integration of the Secret Providers plan, over the vendor's official
 * JavaScript SDK. Two auth lanes per connection: the companion app
 * brokers the user's access (its own prompt, biometric where the user
 * turned it on — the `app` lane), or a service-account token read from
 * the environment at use time and never stored (the `service-account`
 * lane, the headless twin).
 *
 * The SDK core is a large WebAssembly module compiled on load, so it
 * loads on the FIRST use, never at app boot — the one lazy boundary in
 * this module. One SDK client per connection for the process lifetime
 * (creating it is what prompts); the client is dropped on the SDK's
 * session-expired errors so the next use prompts again — the vendor's
 * own session policy, never ours (L1). A probe never creates a client:
 * it reports the SDK's reachability, the lane's credential presence,
 * and the connection's last known failure.
 */

import type { Client, createClient, DesktopAuth } from '@1password/sdk';
import {
  formatSecretLocator,
  type SecretAuthorizeResult,
  type SecretLocator,
  type SecretManagerConnection,
  type SecretProvider,
  type SecretProviderProbe,
  type SecretProviderUnavailableReason,
  type SecretResolution,
} from '@openheaders/core/secret-providers';

/** The SDK's client configuration — not exported by the package, read off its factory. */
type ClientConfiguration = Parameters<typeof createClient>[0];

/** The slice of the SDK module the provider uses — injectable for tests. */
export interface OnePasswordSdk {
  createClient(config: ClientConfiguration): Promise<Client>;
  DesktopAuth: new (accountName: string) => DesktopAuth;
  DesktopSessionExpiredError: new (message: string) => Error;
  AuthExpiredError: new (message: string) => Error;
  RateLimitExceededError: new (message: string) => Error;
}

export interface OnePasswordProviderOptions {
  /** This app's version, stamped on the SDK client as the integration version. */
  integrationVersion: string;
  /** Test seam; defaults to the real SDK, loaded on first use. */
  loadSdk?: () => Promise<OnePasswordSdk>;
  /** Test seam; defaults to the process environment. */
  env?: NodeJS.ProcessEnv;
}

export const SERVICE_ACCOUNT_TOKEN_ENV = 'OP_SERVICE_ACCOUNT_TOKEN';

const INTEGRATION_NAME = 'OpenHeaders';

type OnePasswordConfig = Extract<SecretManagerConnection['config'], { provider: 'onepassword' }>;

interface StandingFailure {
  reason: SecretProviderUnavailableReason;
  detail: string;
}

// The SDK's wasm core compiles synchronously on require — a genuine
// code-splitting boundary, taken on the first secret use.
const loadRealSdk = (): Promise<OnePasswordSdk> => import('@1password/sdk');

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** The vendor's client-creation failures, read into a standing reason the chip can name. */
function classifyClientFailure(message: string): SecretProviderUnavailableReason {
  const text = message.toLowerCase();
  if (/integrat|not enabled|disabled/.test(text)) return 'integration-disabled';
  if (/not running|unable to connect|could not connect|no desktop app|app is not/.test(text)) return 'not-installed';
  if (/lock|denied|reject|cancel/.test(text)) return 'locked';
  return 'unreachable';
}

/** The vendor's resolve failures that mean "no such secret at this reference". */
function isNotFoundMessage(message: string): boolean {
  return /not found|no .*found|does not exist|invalid secret reference|parsing|unknown field|unknown item|unknown vault/i.test(
    message,
  );
}

export function createOnePasswordProvider(options: OnePasswordProviderOptions): SecretProvider {
  const env = options.env ?? process.env;
  const loader = options.loadSdk ?? loadRealSdk;
  let sdkPromise: Promise<OnePasswordSdk> | null = null;
  const clients = new Map<string, { fingerprint: string; client: Promise<Client> }>();
  const failures = new Map<string, StandingFailure>();

  const loadSdk = (): Promise<OnePasswordSdk> => {
    if (sdkPromise === null) {
      sdkPromise = loader().catch((err: unknown) => {
        sdkPromise = null;
        throw err;
      });
    }
    return sdkPromise;
  };

  const configOf = (connection: SecretManagerConnection): OnePasswordConfig | null =>
    connection.config.provider === 'onepassword' ? connection.config : null;

  const fingerprintOf = (config: OnePasswordConfig): string => `${config.auth}:${config.account}`;

  const credentialGap = (config: OnePasswordConfig): StandingFailure | null => {
    if (config.auth === 'service-account') {
      return (env[SERVICE_ACCOUNT_TOKEN_ENV] ?? '').trim() === ''
        ? { reason: 'no-credentials', detail: `${SERVICE_ACCOUNT_TOKEN_ENV} is not set in this app's environment.` }
        : null;
    }
    return config.account.trim() === ''
      ? { reason: 'no-credentials', detail: 'The connection names no account.' }
      : null;
  };

  const authFor = (sdk: OnePasswordSdk, config: OnePasswordConfig): ClientConfiguration['auth'] =>
    config.auth === 'service-account'
      ? (env[SERVICE_ACCOUNT_TOKEN_ENV] ?? '').trim()
      : new sdk.DesktopAuth(config.account.trim());

  /** The connection's client — created (prompting) on first use, reused after. */
  const clientFor = async (connection: SecretManagerConnection, config: OnePasswordConfig): Promise<Client> => {
    const fingerprint = fingerprintOf(config);
    const cached = clients.get(connection.uid);
    if (cached && cached.fingerprint === fingerprint) return cached.client;
    const sdk = await loadSdk();
    const client = sdk
      .createClient({
        auth: authFor(sdk, config),
        integrationName: INTEGRATION_NAME,
        integrationVersion: options.integrationVersion,
      })
      .then(
        (created) => {
          failures.delete(connection.uid);
          return created;
        },
        (err: unknown) => {
          clients.delete(connection.uid);
          const detail = errorMessage(err);
          failures.set(connection.uid, { reason: classifyClientFailure(detail), detail });
          throw err;
        },
      );
    clients.set(connection.uid, { fingerprint, client });
    return client;
  };

  return {
    id: 'onepassword',
    yields: 'concealed-string',

    async probe(connection): Promise<SecretProviderProbe> {
      const config = configOf(connection);
      if (!config) return { available: false, reason: 'not-installed', detail: 'Not a 1Password connection.' };
      try {
        await loadSdk();
      } catch (err) {
        return { available: false, reason: 'not-installed', detail: errorMessage(err) };
      }
      const gap = credentialGap(config);
      if (gap) return { available: false, ...gap };
      const standing = failures.get(connection.uid);
      if (standing) return { available: false, ...standing };
      return { available: true };
    },

    async authorize(connection): Promise<SecretAuthorizeResult> {
      const config = configOf(connection);
      if (!config) return { ok: false, detail: 'Not a 1Password connection.' };
      const gap = credentialGap(config);
      if (gap) return { ok: false, detail: gap.detail };
      try {
        await clientFor(connection, config);
        return { ok: true };
      } catch (err) {
        return { ok: false, detail: errorMessage(err) };
      }
    },

    async resolve(connection, locator: SecretLocator): Promise<SecretResolution> {
      const config = configOf(connection);
      if (!config || locator.provider !== 'onepassword') {
        return { ok: false, reason: 'unavailable', detail: 'Not a 1Password reference.' };
      }
      const gap = credentialGap(config);
      if (gap) return { ok: false, reason: 'unavailable', detail: gap.detail };
      let client: Client;
      try {
        client = await clientFor(connection, config);
      } catch (err) {
        const standing = failures.get(connection.uid);
        return standing?.reason === 'locked'
          ? { ok: false, reason: 'authorization-required', detail: standing.detail }
          : { ok: false, reason: 'unavailable', detail: errorMessage(err) };
      }
      const sdk = await loadSdk();
      try {
        const value = await client.secrets.resolve(formatSecretLocator(locator));
        return { ok: true, value };
      } catch (err) {
        const detail = errorMessage(err);
        if (err instanceof sdk.DesktopSessionExpiredError || err instanceof sdk.AuthExpiredError) {
          // The vendor's session ended — the next use creates a fresh
          // client and prompts again.
          clients.delete(connection.uid);
          return { ok: false, reason: 'authorization-required', detail };
        }
        if (err instanceof sdk.RateLimitExceededError) return { ok: false, reason: 'unavailable', detail };
        if (isNotFoundMessage(detail)) return { ok: false, reason: 'not-found', detail };
        return { ok: false, reason: 'unavailable', detail };
      }
    },
  };
}
