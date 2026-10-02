/**
 * The rule compile's secret-manager scope on the browser host — the
 * Secret Providers plan's P2c. A rule whose template names a vault
 * entry of kind Secret Manager resolves through the desktop app on this
 * device over loopback like a send does, and compiles ONLY into the
 * session layer (L2: Chrome writes dynamic rules to disk; session rules
 * die with the browser). This module is what the compile asks before
 * it resolves, and what the oracle's compile resolver is synced from.
 *
 * The scope is retained across compiles (a value asked once stands —
 * the compile runs on every rule edit, tab event and TOTP tick, and a
 * manager's lock does not strip what is already installed), is asked
 * again only for what it lacks, retries a failed entry only on a
 * compile a person caused (never on a timer's — a denial would
 * re-prompt every half minute otherwise), and is reset by the desktop
 * app's wire events: a close is the fail-closed strip (the next
 * compile reads every entry as unreachable and drops the referencing
 * rules), an open the re-ask. A change to the vault's secret-manager
 * rows recreates it. Nothing here persists.
 */

import { formatSecretLocator } from '@openheaders/core/secret-providers';
import type { Rule, Vault, VaultSecretManager } from '@openheaders/core/types';
import {
  collectRuleTemplateStrings,
  collectTemplateVariableNames,
  createSecretManagerScope,
  EMPTY_SECRET_MANAGER_FAILURES,
  EMPTY_SECRET_MANAGER_REGISTRY,
  type SecretManagerFailures,
  type SecretManagerRegistry,
  type SecretManagerScope,
} from '@openheaders/core/variables';
import { getVault } from '@openheaders/oracle/entity/environment-store';
import {
  type BackendWireHandle,
  subscribeOnWebSocketClose,
  subscribeOnWebSocketOpen,
} from '@openheaders/oracle/sync/client/backend-connection-manager';
import { createLoopbackSecretManagerBroker, isDesktopAppWire } from './loopback-broker';

export interface CompileSecretManagerSnapshot {
  registry: SecretManagerRegistry;
  failures: SecretManagerFailures;
}

const EMPTY_SNAPSHOT: CompileSecretManagerSnapshot = {
  registry: EMPTY_SECRET_MANAGER_REGISTRY,
  failures: EMPTY_SECRET_MANAGER_FAILURES,
};

const broker = createLoopbackSecretManagerBroker();

let snapshot: CompileSecretManagerSnapshot = EMPTY_SNAPSHOT;
let scope: SecretManagerScope | null = null;
let scopeSignature = '';

function secretManagerRows(vault: Vault): VaultSecretManager[] {
  return vault.secrets.filter((s): s is VaultSecretManager => s.kind === 'secret-manager');
}

/** The rows' identity — a renamed or re-pointed row recreates the scope. */
function signatureOf(rows: readonly VaultSecretManager[]): string {
  return rows
    .map((row) => `${row.name}|${row.locator.provider}|${row.locator.connectionId}|${formatSecretLocator(row.locator)}`)
    .join('\n');
}

function freshScope(vault: Vault): SecretManagerScope {
  snapshot = EMPTY_SNAPSHOT;
  return createSecretManagerScope(
    {
      setSecretManagerRegistry: (registry, failures = EMPTY_SECRET_MANAGER_FAILURES) => {
        snapshot = { registry, failures };
      },
    },
    vault,
    (entries) => broker.resolveBatch(entries),
  );
}

function referencedNames(rules: readonly Rule[]): Set<string> {
  const names = new Set<string>();
  for (const rule of rules) {
    for (const name of collectTemplateVariableNames(collectRuleTemplateStrings(rule))) names.add(name);
  }
  return names;
}

/** The compile resolver's read — what the last ask left (the oracle host hook). */
export function getCompileSecretManagerSnapshot(): CompileSecretManagerSnapshot {
  return snapshot;
}

/**
 * The uids of the rules whose templates name a secret-manager entry of
 * the vault — the rules that compile into the session layer only. Read
 * off the RAW rules: after resolve the reference is gone.
 */
export function secretBearingRuleUids(rules: readonly Rule[], vault: Vault = getVault()): Set<string> {
  const names = new Set(secretManagerRows(vault).map((row) => row.name));
  const out = new Set<string>();
  if (names.size === 0) return out;
  for (const rule of rules) {
    for (const name of collectTemplateVariableNames(collectRuleTemplateStrings(rule))) {
      if (names.has(name)) {
        out.add(rule.uid);
        break;
      }
    }
  }
  return out;
}

/**
 * Before a compile: ask the desktop app for the secret-manager entries
 * the rules reference that the scope lacks (a provider may prompt —
 * the compile waits), retrying a failed one only when `retryFailed`
 * says a person caused this compile. `null` when nothing needs asking.
 */
export function prepareCompileSecretManagerScope(
  rules: readonly Rule[],
  options: { retryFailed: boolean },
): Promise<void> | null {
  const vault = getVault();
  const rows = secretManagerRows(vault);
  const signature = signatureOf(rows);
  if (scope === null || signature !== scopeSignature) {
    scope = freshScope(vault);
    scopeSignature = signature;
  }
  if (rows.length === 0) return null;
  return scope.ensure(referencedNames(rules), options.retryFailed);
}

/** Drop everything retained — the next compile asks afresh. */
export function resetCompileSecretManagerScope(): void {
  scope = null;
  scopeSignature = '';
  snapshot = EMPTY_SNAPSHOT;
}

export interface CompileSecretManagerLifecycleDeps {
  /** Run a forced rebuild — the compile that strips or re-asks. */
  rebuild: () => void;
  /** Tell the pages who answers now — the desktop app over loopback,
   *  or nobody while it is away — so their lists and chips refetch. */
  onBrokerChange?: (broker: 'desktop-app' | 'unreachable') => void;
  subscribeOpen?: typeof subscribeOnWebSocketOpen;
  subscribeClose?: typeof subscribeOnWebSocketClose;
}

/**
 * Boot-time: the desktop app's wire closing is the fail-closed strip
 * (the retained values go, the rebuild reads every entry as
 * unreachable and drops the referencing rules from the session layer),
 * its opening the re-ask. A server's wire is never the desktop app's
 * and changes nothing.
 */
export function installCompileSecretManagerLifecycle(deps: CompileSecretManagerLifecycleDeps): () => void {
  const onDesktopWire =
    (broker: 'desktop-app' | 'unreachable') =>
    (wire: BackendWireHandle): void => {
      if (!isDesktopAppWire(wire)) return;
      resetCompileSecretManagerScope();
      deps.rebuild();
      deps.onBrokerChange?.(broker);
    };
  const unsubscribeOpen = (deps.subscribeOpen ?? subscribeOnWebSocketOpen)(onDesktopWire('desktop-app'));
  const unsubscribeClose = (deps.subscribeClose ?? subscribeOnWebSocketClose)(onDesktopWire('unreachable'));
  return () => {
    unsubscribeOpen();
    unsubscribeClose();
  };
}
