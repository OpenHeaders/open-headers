/**
 * Secrets-tier MCP tool — `variables_reveal_secret`, the SOLE exception
 * to the masking contract every other projection honors (vault entries
 * read as name + kind only; `secret`-typed variables read masked).
 *
 * Contract:
 *   - Vault kind `'string'` only. TOTP entries never reveal their seed,
 *     under any tier — `{{vault.<name>}}` resolves to the current code
 *     at send time, which is the only sanctioned use.
 *   - A locked vault (persisted ciphertext present but undecryptable)
 *     reads empty through {@link getVaultForWorkspace}; the tool checks
 *     the lock FIRST so a locked-out state surfaces as "re-entry
 *     required", never as "no such secret".
 *   - A reveal is a terminal read: the value appears in this tool's
 *     result only, never in histories, diffs, or list projections.
 *   - Every reveal logs an info-level line naming the secret and the
 *     calling token — the gate's routine `workspace.read` allow is
 *     demoted to debug, and a plaintext disclosure deserves a durable
 *     signal.
 */

import { hostLogger as logger } from '@openheaders/core/logger';
import { getVaultForWorkspace, isVaultLockedForWorkspace } from '@openheaders/oracle/entity/environment-store';
import { type McpToolDefinition, McpToolInputError } from '../registry';
import { requireStringArg, requireWorkspace, WORKSPACE_ID_PROPERTY } from './common';

export function createSecretToolDefinitions(): McpToolDefinition[] {
  return [
    {
      name: 'variables_reveal_secret',
      title: 'Reveal vault secret',
      description:
        'Reveal the plaintext value of one vault secret by name — the only tool that returns a vault value; ' +
        'every other projection masks them. String secrets only: a TOTP entry never reveals its seed — ' +
        'reference {{vault.<name>}} in a request instead, which resolves to the current code at send time. ' +
        'The value appears in this result only; it is never written to histories, diffs, or lists.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Vault secret name from variables_list.' },
          ...WORKSPACE_ID_PROPERTY,
        },
        required: ['name'],
        additionalProperties: false,
      },
      tier: 'secrets',
      resolveWorkspaceId: (args) => {
        const raw = args.workspaceId;
        return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
      },
      handler: async (args, ctx) => {
        const workspaceId = requireWorkspace(args);
        const name = requireStringArg(args, 'name');
        if (isVaultLockedForWorkspace(workspaceId)) {
          throw new McpToolInputError(
            'the vault is locked on this host — its secrets are unreadable until they are re-entered in Open Headers',
          );
        }
        const secret = getVaultForWorkspace(workspaceId).secrets.find((entry) => entry.name === name);
        if (!secret) {
          throw new McpToolInputError(
            `no vault secret named '${name}' in workspace '${workspaceId}' — see variables_list`,
          );
        }
        if (secret.kind !== 'string') {
          throw new McpToolInputError(
            `'${name}' is a TOTP secret — seeds are never revealed. Reference {{vault.${name}}} to use the current code.`,
          );
        }
        logger.info('Mcp.Secrets', `vault secret '${name}' revealed in ws=${workspaceId} (token=${ctx.tokenId})`);
        return { workspaceId, secret: { name: secret.name, kind: secret.kind, value: secret.value } };
      },
    },
  ];
}
