/**
 * Env-var environment-plane adapter — the node tier's default resolver
 * (FORK A: Env ON by default for daemon / CLI / TUI). Honors the
 * ecosystem-norm variables with curl precedence:
 *
 *   - `https:` targets read `https_proxy`, then `all_proxy`;
 *   - every other scheme reads `http_proxy`, then `all_proxy`;
 *   - `no_proxy` bypasses matching targets entirely;
 *   - each pair is case-insensitive, lowercase winning over UPPERCASE
 *     when both are set (curl's own tie-break).
 *
 * An unset/empty variable, a bypassed target, or an unparsable value
 * resolves `null` — the send goes direct, exactly as the machine
 * asked. The answer is a single-entry chain (env vars carry no
 * fallback semantics), `source: 'env'`.
 */

import { isBypassedByNoProxy } from './no-proxy';
import { parseProxyValue } from './proxy-value';
import type { EnvironmentProxyResolver, EnvironmentProxySelection } from './types';

type EnvReader = () => Record<string, string | undefined>;

/** First non-empty value among the names, in order — the curl
 *  precedence is encoded by the caller's name order. */
function readEnv(env: Record<string, string | undefined>, names: string[]): string | undefined {
  for (const name of names) {
    const value = env[name];
    if (value !== undefined && value.trim() !== '') return value;
  }
  return undefined;
}

/**
 * Build the env-var resolver. `envSource` is injectable so unit rigs
 * drive precedence tables without touching `process.env`; production
 * reads the live environment per resolve (cheap, and honest about a
 * daemon whose environment was set at spawn).
 */
export function createEnvProxyResolver(envSource: EnvReader = () => process.env): EnvironmentProxyResolver {
  return {
    resolve(url: string): Promise<EnvironmentProxySelection | null> {
      let target: URL;
      try {
        target = new URL(url);
      } catch {
        return Promise.resolve(null);
      }
      const env = envSource();
      const secure = target.protocol === 'https:' || target.protocol === 'wss:';
      const configured = readEnv(
        env,
        secure
          ? ['https_proxy', 'HTTPS_PROXY', 'all_proxy', 'ALL_PROXY']
          : ['http_proxy', 'HTTP_PROXY', 'all_proxy', 'ALL_PROXY'],
      );
      if (configured === undefined) return Promise.resolve(null);
      const noProxy = readEnv(env, ['no_proxy', 'NO_PROXY']);
      if (noProxy !== undefined) {
        const port = target.port !== '' ? Number(target.port) : secure ? 443 : 80;
        if (isBypassedByNoProxy(target.hostname, port, noProxy)) return Promise.resolve(null);
      }
      const entry = parseProxyValue(configured);
      if (entry === null) return Promise.resolve(null);
      return Promise.resolve({ entries: [entry], source: 'env' });
    },
  };
}
