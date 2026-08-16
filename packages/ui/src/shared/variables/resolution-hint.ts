/**
 * resolutionHint — keyed mirror of core's `buildHint`
 * (`@openheaders/core/variables/resolver`). Core keeps minting the
 * English `hint` string for the operational plane; UI surfaces render
 * through this helper so hints translate. The mapping consumes only
 * structured fields (`reason`, `namespace`, `activeEnvironmentId`,
 * `params`) — never the English text. `invalid-resolved-value` errors
 * carry their dominant domain-issue kind on `params.domainIssueKind`;
 * without it (site-specific custom hints predating the structured
 * field) the raw `hint` is the fallback.
 */

import type { DomainIssueKind } from '@openheaders/core/utils';
import type { ResolutionError } from '@openheaders/core/variables';
import type { MessageKey } from '@openheaders/i18n';
import type { Translate } from '@openheaders/ui/context/LocaleContext';

const DOMAIN_ISSUE_HINT_KEY: Record<DomainIssueKind, MessageKey> = {
  whitespace: 'shared.resolutionHint.invalidDomain.whitespace',
  scheme: 'shared.resolutionHint.invalidDomain.scheme',
  wildcard: 'shared.resolutionHint.invalidDomain.wildcard',
  port: 'shared.resolutionHint.invalidDomain.port',
  uppercase: 'shared.resolutionHint.invalidDomain.uppercase',
  'non-ascii': 'shared.resolutionHint.invalidDomain.nonAscii',
  empty: 'shared.resolutionHint.invalidDomain.empty',
};

function unsetInScopeKey(error: ResolutionError): MessageKey {
  switch (error.namespace) {
    case 'env':
      return error.activeEnvironmentId
        ? 'shared.resolutionHint.unset.envActive'
        : 'shared.resolutionHint.unset.envNoActive';
    case 'vault':
      return 'shared.resolutionHint.unset.vault';
    case 'collection':
      return 'shared.resolutionHint.unset.collection';
    case 'workspace':
      return 'shared.resolutionHint.unset.workspace';
    case 'file':
      return 'shared.resolutionHint.unset.file';
    case 'live':
      return 'shared.resolutionHint.unset.live';
    case 'step':
      return 'shared.resolutionHint.unset.step';
    case 'dynamic':
      return 'shared.resolutionHint.unset.dynamic';
    default:
      return 'shared.resolutionHint.unset.generic';
  }
}

export function resolutionHint(t: Translate, error: ResolutionError): string {
  switch (error.reason) {
    case 'empty':
      return t('shared.resolutionHint.empty');
    case 'unknown-namespace':
      return t('shared.resolutionHint.unknownNamespace');
    case 'unset-in-scope':
      return t(unsetInScopeKey(error));
    case 'step-out-of-context':
      return t('shared.resolutionHint.stepOutOfContext');
    case 'unresolved':
      return t('shared.resolutionHint.unresolved');
    case 'secret-authorization-required':
      return t('shared.resolutionHint.secretAuthorizationRequired');
    case 'secret-not-found':
      return t('shared.resolutionHint.secretNotFound');
    case 'secret-unavailable':
      return t('shared.resolutionHint.secretUnavailable');
    case 'invalid-resolved-value': {
      const kind = error.params?.domainIssueKind;
      return kind ? t(DOMAIN_ISSUE_HINT_KEY[kind]) : error.hint;
    }
  }
}
