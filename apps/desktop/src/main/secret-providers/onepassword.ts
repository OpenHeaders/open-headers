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
 * the connection's last known failure, and — while a client is held —
 * the moment of its last successful contact, so a surface can read
 * "connected, verified at 16:07" instead of a session it cannot see.
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
  /** Test seam; the clock the verified moments read. */
  now?: () => number;
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

// The SDK's own texts when the companion app's library is absent on this
// machine or failed to load into this process, beside the app-not-running shapes.
const NOT_INSTALLED_MESSAGE =
  /application not found|native library is not available|not running|unable to connect|could not connect|no desktop app|app is not/;

/** The vendor's client-creation failures, read into a standing reason the chip can name. */
function classifyClientFailure(message: string): SecretProviderUnavailableReason {
  const text = message.toLowerCase();
  if (/integrat|not enabled|disabled/.test(text)) return 'integration-disabled';
  if (NOT_INSTALLED_MESSAGE.test(text)) return 'not-installed';
  // The live deny shape: "Denied authorization for SDK client".
  if (/denied|reject|cancel|dismiss/.test(text)) return 'denied';
  if (/lock/.test(text)) return 'locked';
  return 'unreachable';
}

/**
 * The SDK's answer on a client handle whose session the vendor rebuilt
 * underneath it — seen live after a 1Password lock: the list call
 * re-prompted through the SDK's own re-initialization, the user
 * approved, and the held handle answered "invalid client id". The
 * handle is stale, the approval window is open: re-create the client
 * (silently, inside the window) rather than read a refusal.
 */
function isStaleClientMessage(message: string): boolean {
  return /invalid client id/i.test(message);
}

/** The vendor's resolve failures that mean "no such secret at this reference" —
 *  the live text reads "no vault matched the secret reference query". */
function isNotFoundMessage(message: string): boolean {
  return /not found|no .*found|no .*matched|does not exist|invalid secret reference|parsing|unknown field|unknown item|unknown vault/i.test(
    message,
  );
}

export function createOnePasswordProvider(options: OnePasswordProviderOptions): SecretProvider {
  const env = options.env ?? process.env;
  const loader = options.loadSdk ?? loadRealSdk;
  const now = options.now ?? Date.now;
  let sdkPromise: Promise<OnePasswordSdk> | null = null;
  const clients = new Map<string, { fingerprint: string; client: Promise<Client> }>();
  const failures = new Map<string, StandingFailure>();
  /** The last successful contact per connection, held with its client. */
  const verified = new Map<string, number>();

  const dropClient = (uid: string): void => {
    clients.delete(uid);
    verified.delete(uid);
  };

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

  /** The connection's client — created (prompting) on first use, reused
   *  after. The pending creation is cached before anything is awaited, so
   *  a send resolving several entries of one connection creates one
   *  client and prompts once. */
  const clientFor = (connection: SecretManagerConnection, config: OnePasswordConfig): Promise<Client> => {
    const fingerprint = fingerprintOf(config);
    const cached = clients.get(connection.uid);
    if (cached && cached.fingerprint === fingerprint) return cached.client;
    const client = loadSdk()
      .then((sdk) =>
        sdk.createClient({
          auth: authFor(sdk, config),
          integrationName: INTEGRATION_NAME,
          integrationVersion: options.integrationVersion,
        }),
      )
      .then(
        (created) => {
          failures.delete(connection.uid);
          verified.set(connection.uid, now());
          return created;
        },
        (err: unknown) => {
          dropClient(connection.uid);
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
      const verifiedAt = verified.get(connection.uid);
      return verifiedAt === undefined ? { available: true } : { available: true, verifiedAt };
    },

    async authorize(connection): Promise<SecretAuthorizeResult> {
      const config = configOf(connection);
      if (!config) return { ok: false, detail: 'Not a 1Password connection.' };
      const gap = credentialGap(config);
      if (gap) return { ok: false, reason: gap.reason, detail: gap.detail };
      const creationFailed = (err: unknown): SecretAuthorizeResult => {
        const standing = failures.get(connection.uid);
        return { ok: false, reason: standing?.reason ?? 'unreachable', detail: errorMessage(err) };
      };
      let client: Client;
      try {
        client = await clientFor(connection, config);
      } catch (err) {
        return creationFailed(err);
      }
      // A held client answers without touching the manager, and a Test
      // is a round trip: list the vaults. A live session answers; a
      // lapsed one re-prompts through the SDK, or ends the session, in
      // which case the client is re-created (prompting again); any
      // other refusal becomes the standing state and drops the client,
      // so nothing stays claimed that the manager just refused.
      try {
        await client.vaults.list();
        verified.set(connection.uid, now());
        return { ok: true };
      } catch (err) {
        dropClient(connection.uid);
        const sdk = await loadSdk();
        if (
          err instanceof sdk.DesktopSessionExpiredError ||
          err instanceof sdk.AuthExpiredError ||
          isStaleClientMessage(errorMessage(err))
        ) {
          try {
            await clientFor(connection, config);
            return { ok: true };
          } catch (again) {
            return creationFailed(again);
          }
        }
        const detail = errorMessage(err);
        const reason = classifyClientFailure(detail);
        failures.set(connection.uid, { reason, detail });
        return { ok: false, reason, detail };
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
        return standing?.reason === 'locked' || standing?.reason === 'denied'
          ? { ok: false, reason: 'authorization-required', detail: standing.detail }
          : { ok: false, reason: 'unavailable', detail: errorMessage(err) };
      }
      const sdk = await loadSdk();
      const failed = (err: unknown): SecretResolution => {
        const detail = errorMessage(err);
        if (err instanceof sdk.DesktopSessionExpiredError || err instanceof sdk.AuthExpiredError) {
          // The vendor's session ended — the next use creates a fresh
          // client and prompts again; nothing is verified until it does.
          dropClient(connection.uid);
          return { ok: false, reason: 'authorization-required', detail };
        }
        if (err instanceof sdk.RateLimitExceededError) return { ok: false, reason: 'unavailable', detail };
        if (isNotFoundMessage(detail)) return { ok: false, reason: 'not-found', detail };
        const reason = classifyClientFailure(detail);
        if (reason === 'denied' || reason === 'locked') {
          // The SDK rebuilt its session underneath this call (a lock)
          // and the person declined the prompt — a client-creation
          // outcome that reached us through the resolve: the standing
          // state it leaves, the next send a new attempt.
          dropClient(connection.uid);
          failures.set(connection.uid, { reason, detail });
          return { ok: false, reason: 'authorization-required', detail };
        }
        return { ok: false, reason: 'unavailable', detail };
      };
      const reference = formatSecretLocator(locator);
      try {
        const value = await client.secrets.resolve(reference);
        verified.set(connection.uid, now());
        return { ok: true, value };
      } catch (err) {
        if (!isStaleClientMessage(errorMessage(err))) return failed(err);
      }
      // A stale handle after a lock: the vendor already re-approved
      // through the SDK, so one fresh client and one retry answer the
      // same send — never a second send for the person.
      dropClient(connection.uid);
      try {
        client = await clientFor(connection, config);
      } catch (err) {
        const standing = failures.get(connection.uid);
        return standing?.reason === 'locked' || standing?.reason === 'denied'
          ? { ok: false, reason: 'authorization-required', detail: standing.detail }
          : { ok: false, reason: 'unavailable', detail: errorMessage(err) };
      }
      try {
        const value = await client.secrets.resolve(reference);
        verified.set(connection.uid, now());
        return { ok: true, value };
      } catch (err) {
        return failed(err);
      }
    },
  };
}
