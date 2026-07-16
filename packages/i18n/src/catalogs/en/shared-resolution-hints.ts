/**
 * Resolution-hint family — the keyed mirror of core's `buildHint`
 * (`packages/core/src/variables/resolver/errors.ts`). Core keeps
 * minting the English `hint` string as the operational-plane fallback
 * (SW logs, non-UI consumers); UI surfaces render these keys from
 * `ResolutionError.reason` + `params` via the shared
 * `resolutionHint(t, error)` helper instead. Values are byte-faithful
 * to core's English — never edit one side without the other.
 *
 * Raw by design inside keyed sentences: `{{name}}` /
 * `{{namespace.name}}` / `{{dynamic.uuid}}` / `{{step.<stepId>.
 * <captureName>}}` reference syntax, namespace ids (env, vault, …),
 * `requestDomains` / sha256 / punycode / xn-- technical vocabulary.
 * The `invalidDomain.*` keys are whole sentences per
 * `DomainIssueKind` — the dominant kind arrives structurally on
 * `params.domainIssueKind`, never parsed out of the English hint.
 */

import type { Catalog } from '../../types';

export const sharedResolutionHints = {
  'shared.resolutionHint.empty': 'Reference is empty. Use {{name}} or {{namespace.name}}.',
  'shared.resolutionHint.unknownNamespace':
    'Unknown namespace. Valid namespaces: env, vault, collection, workspace, file, live, step, dynamic.',
  'shared.resolutionHint.unset.envActive':
    'Set this variable in Environments → active environment (or in the default environment as a fallback).',
  'shared.resolutionHint.unset.envNoActive':
    'No active environment is selected. Select one in Environments, or set a default environment.',
  'shared.resolutionHint.unset.vault': 'Set this secret in the Vault.',
  'shared.resolutionHint.unset.collection': 'Set this variable in the current collection.',
  'shared.resolutionHint.unset.workspace': 'Set this variable in Workspace Variables.',
  'shared.resolutionHint.unset.file': 'Upload this file in Settings → Files (or reference it by its sha256 hash).',
  'shared.resolutionHint.unset.live':
    'No Live Variable by that name. Create one in Live Variables, or wait for its first refresh to populate.',
  'shared.resolutionHint.unset.step':
    'Step id or capture name not found in this workflow run. Check the workflow step configuration.',
  'shared.resolutionHint.unset.dynamic':
    'No built-in generator by that name. Pick one from the suggestion list ({{dynamic.uuid}}, {{dynamic.timestamp}}, …).',
  'shared.resolutionHint.unset.generic': 'Not set in this scope.',
  'shared.resolutionHint.stepOutOfContext':
    'Step references ({{step.<stepId>.<captureName>}}) are only valid inside a Live Workflow step.',
  'shared.resolutionHint.unresolved':
    'Not found in vault, environment, collection, or workspace. Define it in one of those scopes.',
  'shared.resolutionHint.invalidDomain.whitespace':
    'Variable resolved to a value Chrome rejects in this slot — contains whitespace (separate hostnames with commas). Use bare hostnames separated by commas.',
  'shared.resolutionHint.invalidDomain.scheme':
    'Variable resolved to a value Chrome rejects in this slot — contains a scheme — drop the protocol prefix. Use bare hostnames separated by commas.',
  'shared.resolutionHint.invalidDomain.wildcard':
    'Variable resolved to a value Chrome rejects in this slot — contains a wildcard — requestDomains auto-matches subdomains. Use bare hostnames separated by commas.',
  'shared.resolutionHint.invalidDomain.port':
    'Variable resolved to a value Chrome rejects in this slot — contains a port — requestDomains matches by hostname only. Use bare hostnames separated by commas.',
  'shared.resolutionHint.invalidDomain.uppercase':
    'Variable resolved to a value Chrome rejects in this slot — contains uppercase characters — requestDomains is lowercase ASCII. Use bare hostnames separated by commas.',
  'shared.resolutionHint.invalidDomain.nonAscii':
    'Variable resolved to a value Chrome rejects in this slot — contains characters Chrome rejects (use punycode for IDN names). Use bare hostnames separated by commas.',
  'shared.resolutionHint.invalidDomain.empty':
    'Variable resolved to a value Chrome rejects in this slot — is empty after sanitization. Use bare hostnames separated by commas.',
} as const satisfies Catalog;
