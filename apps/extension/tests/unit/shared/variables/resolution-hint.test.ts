import { describe, expect, it } from 'vitest';
import { DOMAIN_ISSUE_SUMMARY, type DomainIssueKind } from '@openheaders/core/utils';
import {
  buildPostResolveError,
  type ResolutionEnvSnapshot,
  type ResolutionError,
} from '@openheaders/core/variables';
import { DEFAULT_LOCALE, getTranslator } from '@openheaders/i18n';
import { resolutionHint } from '@openheaders/ui/shared/variables';

const t = getTranslator(DEFAULT_LOCALE);

const NO_ENV: ResolutionEnvSnapshot = { activeEnvironmentId: null, defaultEnvironmentId: null };
const ACTIVE_ENV: ResolutionEnvSnapshot = { activeEnvironmentId: 'env-dev', defaultEnvironmentId: null };

function err(reference: string, reason: ResolutionError['reason'], env = NO_ENV): ResolutionError {
  return buildPostResolveError(reference, reason, env);
}

describe('resolutionHint', () => {
  it('mirrors core buildHint byte-for-byte across every reason / namespace', () => {
    const errors: ResolutionError[] = [
      err('', 'empty'),
      err('foo.X', 'unknown-namespace'),
      err('env.API_URL', 'unset-in-scope', ACTIVE_ENV),
      err('env.API_URL', 'unset-in-scope', NO_ENV),
      err('vault.SECRET', 'unset-in-scope'),
      err('collection.X', 'unset-in-scope'),
      err('workspace.X', 'unset-in-scope'),
      err('file.report', 'unset-in-scope'),
      err('live.token', 'unset-in-scope'),
      err('step.s1.capture', 'unset-in-scope'),
      err('dynamic.nope', 'unset-in-scope'),
      err('FLAT_NAME', 'unset-in-scope'),
      err('step.s1.capture', 'step-out-of-context'),
      err('FLAT_NAME', 'unresolved'),
    ];
    for (const e of errors) {
      expect(resolutionHint(t, e), `${e.reason} / ${e.reference}`).toBe(e.hint);
    }
  });

  it('renders invalid-resolved-value from the structured domain-issue kind', () => {
    const kinds: DomainIssueKind[] = ['whitespace', 'scheme', 'wildcard', 'port', 'uppercase', 'non-ascii', 'empty'];
    for (const kind of kinds) {
      const e = buildPostResolveError(
        'env.HOSTS',
        'invalid-resolved-value',
        ACTIVE_ENV,
        `Variable resolved to a value Chrome rejects in this slot — ${DOMAIN_ISSUE_SUMMARY[kind]}. Use bare hostnames separated by commas.`,
        { domainIssueKind: kind },
      );
      expect(resolutionHint(t, e), kind).toBe(e.hint);
    }
  });

  it('falls back to the raw hint when invalid-resolved-value carries no params', () => {
    const e = err('env.HOSTS', 'invalid-resolved-value', ACTIVE_ENV);
    expect(resolutionHint(t, e)).toBe(e.hint);
  });
});
