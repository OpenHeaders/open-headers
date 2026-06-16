/**
 * Chrome adapter for the oracle {@link CdpTabControlPort} — the declarative
 * standing-state port. `apply` diffs the desired {@link CdpTabControlState}
 * against the session's last-applied state via the pure
 * {@link reconcileTabControl}, then executes each resulting primitive
 * command through the shared {@link CdpSessionSender}. `forget` drops the
 * remembered state so the next `apply` reconciles from
 * {@link EMPTY_TAB_CONTROL_STATE} — the replay-on-reattach guarantee.
 *
 * The adapter is a dumb executor: the diff is pure oracle logic, and every
 * command rides `chrome-debugger-source`'s session sender (no chrome API
 * named here, no second attach path). Command coverage grows with
 * {@link reconcileTabControl} as Phases D/E/F land.
 */

import {
  type CdpControlCommand,
  type CdpFetchPattern,
  type CdpNetworkConditions,
  type CdpSessionTarget,
  type CdpTabControlPort,
  type CdpTabControlState,
  EMPTY_TAB_CONTROL_STATE,
  reconcileTabControl,
} from '@openheaders/oracle/correlator-cdp';
import { logger } from '@utils/logger';
import type { CdpSessionSender } from './cdp-session-sender';

/** `Network.emulateNetworkConditions` params that lift every throttle. */
const NO_THROTTLE = {
  offline: false,
  latency: 0,
  downloadThroughput: -1,
  uploadThroughput: -1,
} as const;

/** `Page.addScriptToEvaluateOnNewDocument` result — the per-script id to remove by. */
interface RawAddScriptResult {
  readonly identifier: string;
}

/** `Runtime.evaluate` result — only the returned-by-value primitive is read. */
interface RawEvaluateResult {
  readonly result?: { readonly value?: unknown };
}

function targetKey(target: CdpSessionTarget): string {
  return `${target.tabId}:${target.sessionId}`;
}

function emulateParams(conditions: CdpNetworkConditions): Record<string, unknown> {
  return {
    offline: conditions.offline,
    latency: conditions.latencyMs,
    downloadThroughput: conditions.downloadThroughputBps,
    uploadThroughput: conditions.uploadThroughputBps,
  };
}

export class ChromeCdpTabControlPort implements CdpTabControlPort {
  private readonly sender: CdpSessionSender;
  /** Per-target last-applied state — the `prev` side of every diff. */
  private readonly lastApplied = new Map<string, CdpTabControlState>();
  /**
   * Per-target bootstrap-script ids: `targetKey → (scriptKey → CDP identifier)`.
   * `Page.addScriptToEvaluateOnNewDocument` returns an identifier the matching
   * remove needs, but the pure {@link reconcileTabControl} only knows the
   * stable `key`. So this key→id mapping is the adapter's documented stateful
   * exception to the dumb-executor rule. Dropped on `forget` exactly as
   * {@link lastApplied} is — a re-attach replays the adds with fresh ids.
   */
  private readonly bootstrapIds = new Map<string, Map<string, string>>();
  /**
   * Per-target captured real User-Agent: `targetKey → navigator.userAgent`.
   * CDP has no clean UA reset — `Network.setUserAgentOverride` keeps the
   * override live until the real UA is re-sent, which only the page knows. So
   * the adapter reads the page's UA once (before the first override lands) and
   * replays it on `clear-user-agent-override`. Like {@link bootstrapIds}, this
   * is the adapter's documented stateful exception to the dumb-executor rule,
   * dropped on `forget` — a re-attach (which itself clears all CDP overrides)
   * re-captures.
   */
  private readonly capturedUserAgents = new Map<string, string>();

  constructor(sender: CdpSessionSender) {
    this.sender = sender;
  }

  get available(): boolean {
    return this.sender.cdpAvailable;
  }

  async apply(target: CdpSessionTarget, state: CdpTabControlState): Promise<void> {
    const key = targetKey(target);
    const prev = this.lastApplied.get(key) ?? EMPTY_TAB_CONTROL_STATE;
    const commands = reconcileTabControl(prev, state);
    // Commit the remembered state only after every command lands. If one
    // rejects, `lastApplied` stays at `prev`, so a later `apply` re-diffs
    // and re-issues the whole set — safe because every command is
    // idempotent.
    for (const command of commands) {
      await this.execute(target, command);
    }
    this.lastApplied.set(key, state);
  }

  forget(target: CdpSessionTarget): void {
    const key = targetKey(target);
    this.lastApplied.delete(key);
    this.bootstrapIds.delete(key);
    this.capturedUserAgents.delete(key);
  }

  private execute(target: CdpSessionTarget, command: CdpControlCommand): Promise<unknown> {
    const { tabId, sessionId } = target;
    switch (command.kind) {
      case 'set-cache-disabled':
        return this.sender.sendOnSession(tabId, sessionId, 'Network.setCacheDisabled', {
          cacheDisabled: command.cacheDisabled,
        });
      case 'emulate-network-conditions':
        return this.sender.sendOnSession(
          tabId,
          sessionId,
          'Network.emulateNetworkConditions',
          emulateParams(command.conditions),
        );
      case 'clear-network-conditions':
        return this.sender.sendOnSession(tabId, sessionId, 'Network.emulateNetworkConditions', { ...NO_THROTTLE });
      case 'set-user-agent-override':
        return this.setUserAgentOverride(target, command.userAgent, command.acceptLanguage, command.platform);
      case 'clear-user-agent-override':
        return this.clearUserAgentOverride(target);
      case 'set-bypass-csp':
        return this.sender.sendOnSession(tabId, sessionId, 'Page.setBypassCSP', { enabled: command.enabled });
      case 'enable-fetch':
        // `Fetch.enable` replaces the active pattern set wholesale, so a
        // changed set is just another enable with the new patterns.
        // `handleAuthRequests` opts this session into the second-stage
        // `Fetch.authRequired` challenge events (D3).
        return this.sender.sendOnSession(tabId, sessionId, 'Fetch.enable', {
          patterns: command.patterns.map(fetchPatternParams),
          handleAuthRequests: command.handleAuthRequests,
        });
      case 'disable-fetch':
        return this.sender.sendOnSession(tabId, sessionId, 'Fetch.disable');
      case 'add-bootstrap-script':
        return this.addBootstrapScript(target, command.key, command.source);
      case 'remove-bootstrap-script':
        return this.removeBootstrapScript(target, command.key);
    }
  }

  /**
   * `Page.addScriptToEvaluateOnNewDocument` — install a document-bootstrap
   * script and remember the CDP-returned identifier under `(target, key)` so
   * a later remove can target it. The script runs before any page script on
   * every subsequent document load until removed.
   */
  private async addBootstrapScript(target: CdpSessionTarget, key: string, source: string): Promise<void> {
    const result = await this.sender.sendOnSession(
      target.tabId,
      target.sessionId,
      'Page.addScriptToEvaluateOnNewDocument',
      { source },
    );
    const raw = result as RawAddScriptResult | undefined;
    if (typeof raw?.identifier !== 'string') {
      throw new Error('Page.addScriptToEvaluateOnNewDocument returned an unexpected shape');
    }
    const mapKey = targetKey(target);
    let ids = this.bootstrapIds.get(mapKey);
    if (ids === undefined) {
      ids = new Map<string, string>();
      this.bootstrapIds.set(mapKey, ids);
    }
    ids.set(key, raw.identifier);
  }

  /**
   * `Page.removeScriptToEvaluateOnNewDocument` — retire the bootstrap script
   * tracked under `(target, key)`. A missing id (the add never landed, or the
   * map was already `forget`-ten) is tolerated: log and skip rather than send
   * a bogus identifier.
   */
  private async removeBootstrapScript(target: CdpSessionTarget, key: string): Promise<void> {
    const ids = this.bootstrapIds.get(targetKey(target));
    const identifier = ids?.get(key);
    if (ids === undefined || identifier === undefined) {
      logger.debug('CdpTabControl', 'remove-bootstrap-script: no tracked id', {
        tabId: target.tabId,
        sessionId: target.sessionId,
        key,
      });
      return;
    }
    await this.sender.sendOnSession(target.tabId, target.sessionId, 'Page.removeScriptToEvaluateOnNewDocument', {
      identifier,
    });
    ids.delete(key);
  }

  /**
   * `Network.setUserAgentOverride` — pin the UA triple. Captures the page's real
   * UA first (so a later clear can restore it), then sends only the present
   * facets. When `userAgent` is absent (only `acceptLanguage`/`platform` pinned)
   * CDP still requires a UA value, so the captured real UA fills it; if even
   * that is unavailable the override is skipped (clearing then needs a reload).
   */
  private async setUserAgentOverride(
    target: CdpSessionTarget,
    userAgent: string | undefined,
    acceptLanguage: string | undefined,
    platform: string | undefined,
  ): Promise<void> {
    const realUserAgent = await this.captureRealUserAgent(target);
    const effectiveUserAgent = userAgent ?? realUserAgent;
    if (effectiveUserAgent === undefined) {
      logger.debug('CdpTabControl', 'set-user-agent-override: no UA to send', {
        tabId: target.tabId,
        sessionId: target.sessionId,
      });
      return;
    }
    await this.sender.sendOnSession(target.tabId, target.sessionId, 'Network.setUserAgentOverride', {
      userAgent: effectiveUserAgent,
      ...(acceptLanguage !== undefined ? { acceptLanguage } : {}),
      ...(platform !== undefined ? { platform } : {}),
    });
  }

  /**
   * Restore the page's real UA — CDP has no UA reset, so re-send the captured
   * real UA. A missing capture (the read failed, or nothing was ever overridden)
   * is tolerated: log and skip, leaving the override to clear on the next reload
   * or detach.
   */
  private async clearUserAgentOverride(target: CdpSessionTarget): Promise<void> {
    const realUserAgent = this.capturedUserAgents.get(targetKey(target));
    if (realUserAgent === undefined) {
      logger.debug('CdpTabControl', 'clear-user-agent-override: no captured UA', {
        tabId: target.tabId,
        sessionId: target.sessionId,
      });
      return;
    }
    await this.sender.sendOnSession(target.tabId, target.sessionId, 'Network.setUserAgentOverride', {
      userAgent: realUserAgent,
    });
  }

  /**
   * Read `navigator.userAgent` once per target and cache it. Called before the
   * first override lands (the page still reports its real UA then; a re-attach
   * has cleared any prior override). A read fault leaves the cache empty — the
   * override still applies, only the clean clear is forfeited.
   */
  private async captureRealUserAgent(target: CdpSessionTarget): Promise<string | undefined> {
    const key = targetKey(target);
    const existing = this.capturedUserAgents.get(key);
    if (existing !== undefined) return existing;
    try {
      const result = await this.sender.sendOnSession(target.tabId, target.sessionId, 'Runtime.evaluate', {
        expression: 'navigator.userAgent',
        returnByValue: true,
      });
      const value = (result as RawEvaluateResult | undefined)?.result?.value;
      if (typeof value === 'string' && value.length > 0) {
        this.capturedUserAgents.set(key, value);
        return value;
      }
    } catch (err) {
      logger.debug('CdpTabControl', 'capture real UA failed', {
        tabId: target.tabId,
        sessionId: target.sessionId,
        message: (err as Error).message,
      });
    }
    return undefined;
  }
}

/** Map an oracle {@link CdpFetchPattern} onto CDP `Fetch.RequestPattern`,
 *  omitting absent optional fields so the wire payload stays minimal. */
function fetchPatternParams(pattern: CdpFetchPattern): Record<string, unknown> {
  return {
    urlPattern: pattern.urlPattern,
    ...(pattern.requestStage !== undefined ? { requestStage: pattern.requestStage } : {}),
    ...(pattern.resourceType !== undefined ? { resourceType: pattern.resourceType } : {}),
  };
}
