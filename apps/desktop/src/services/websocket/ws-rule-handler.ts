/**
 * WebSocket Rule Handler — broadcasts resolved V5 rules to connected
 * browser extensions and handles toggle/delete messages from extensions.
 *
 * Rules arrive pre-resolved (no {{VAR}} templates) from WorkspaceStateService.
 * Toggle/delete actions from extensions are forwarded back to WorkspaceStateService
 * via callbacks, which triggers a full re-resolve + re-broadcast cycle.
 */

import type { V5 } from '@openheaders/core/types';
import WS from 'ws';
import mainLogger from '@/utils/mainLogger';

const { createLogger } = mainLogger;
const log = createLogger('WSRuleHandler');

export interface RuleClientSender {
  sendRulesToClient(ws: WS): Promise<void>;
}

/**
 * Callbacks for rule mutations initiated by the extension.
 * These round-trip through WorkspaceStateService to ensure
 * state, disk, and re-broadcast all stay in sync.
 */
export interface RuleMutationCallbacks {
  toggleRule(uid: string, enabled: boolean): Promise<void>;
  removeRule(uid: string): Promise<void>;
}

interface RuleHandlerDeps {
  _broadcastToAll(message: string): number;
}

class WSRuleHandler implements RuleClientSender {
  private readonly wsService: RuleHandlerDeps;
  private rules: V5.Rule[] = [];
  private mutationCallbacks: RuleMutationCallbacks | null = null;

  constructor(wsService: RuleHandlerDeps) {
    this.wsService = wsService;
  }

  /**
   * Wire callbacks for extension-initiated mutations.
   * Called once during service configuration.
   */
  setMutationCallbacks(callbacks: RuleMutationCallbacks): void {
    this.mutationCallbacks = callbacks;
  }

  /**
   * Update the rule set and broadcast to all connected extensions.
   * Rules must already be resolved (no {{VAR}} templates).
   */
  updateRules(resolvedRules: V5.Rule[]): void {
    this.rules = resolvedRules;
    this.broadcastRules();
  }

  /**
   * Broadcast current rules to all connected WebSocket clients.
   */
  broadcastRules(): void {
    const message = JSON.stringify({
      type: 'rulesUpdate',
      rules: this.rules,
    });
    const count = this.wsService._broadcastToAll(message);
    log.info(`Broadcast ${this.rules.length} rules to ${count} client(s)`);
  }

  /**
   * Send current rules to a single newly-connected client.
   */
  async sendRulesToClient(ws: WS): Promise<void> {
    if (ws.readyState !== WS.OPEN) return;
    const message = JSON.stringify({
      type: 'rulesUpdate',
      rules: this.rules,
    });
    ws.send(message);
    log.info(`Sent ${this.rules.length} rules to client`);
  }

  /**
   * Handle toggle request from extension.
   * Round-trips through WorkspaceStateService, which persists the change
   * and triggers a full re-resolve + re-broadcast.
   */
  async handleToggleRule(ruleId: string | number, enabled: boolean): Promise<void> {
    if (!this.mutationCallbacks) {
      log.warn('Toggle rule — mutation callbacks not configured');
      return;
    }
    const uid = String(ruleId);
    log.info(`Toggle rule ${uid} to ${enabled}`);
    await this.mutationCallbacks.toggleRule(uid, enabled);
  }

  /**
   * Handle bulk toggle from extension.
   */
  async handleToggleAllRules(ruleIds: string[], enabled: boolean): Promise<void> {
    if (!this.mutationCallbacks) {
      log.warn('Toggle all rules — mutation callbacks not configured');
      return;
    }
    log.info(`Toggle ${ruleIds.length} rules to ${enabled}`);
    for (const uid of ruleIds) {
      await this.mutationCallbacks.toggleRule(uid, enabled);
    }
  }

  /**
   * Handle delete request from extension.
   * Round-trips through WorkspaceStateService for full state consistency.
   */
  async handleDeleteRule(ruleId: string | number): Promise<boolean> {
    if (!this.mutationCallbacks) {
      log.warn('Delete rule — mutation callbacks not configured');
      return false;
    }
    const uid = String(ruleId);
    log.info(`Delete rule ${uid}`);
    try {
      await this.mutationCallbacks.removeRule(uid);
      return true;
    } catch (error) {
      log.error(`Failed to delete rule ${uid}:`, error);
      return false;
    }
  }
}

export { WSRuleHandler };
