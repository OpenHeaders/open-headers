/**
 * "In Rule / Request / Template" view — the variables the focused entity
 * actually references, each resolved against every scope. Rendered as the
 * same Variable | Value table the "All scopes" view uses, with a leading
 * scope-glyph column so each row shows which scope it resolved from, plus
 * a resolved/unresolved summary and the structured resolution-error list.
 */

import type { ResolutionError } from '@openheaders/core/variables';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Typography, theme } from 'antd';
import { ResolutionErrorList } from './ResolutionErrorList';
import type { DisplayVariable, ScopeKind } from './types';
import { VariableTable } from './VariableTable';

const { Text } = Typography;

interface InContextViewProps {
  vars: DisplayVariable[];
  errors: ResolutionError[];
  scopeKind: ScopeKind;
  hasContext: boolean;
}

export function InContextView({ vars, errors, scopeKind, hasContext }: InContextViewProps) {
  const { token } = theme.useToken();
  const t = useT();
  const noun = t(
    scopeKind === 'request'
      ? 'workbench.variables.panel.noun.request'
      : scopeKind === 'template'
        ? 'workbench.variables.panel.noun.template'
        : 'workbench.variables.panel.noun.rule',
  );
  if (!hasContext) {
    return (
      <Text type="secondary" style={{ fontSize: 11 }}>
        {t('workbench.variables.panel.openHint')}
      </Text>
    );
  }
  if (vars.length === 0) {
    return (
      <Text type="secondary" style={{ fontSize: 11 }}>
        {t('workbench.variables.panel.noneReferenced', { noun })}
      </Text>
    );
  }
  const resolvedCount = vars.filter((v) => v.resolved).length;
  return (
    <>
      <VariableTable variables={vars} showScopeGlyph emptyMode="unresolved" />
      <div style={{ marginTop: 10, fontSize: 11 }}>
        {resolvedCount === vars.length ? (
          <Text style={{ color: token.colorSuccess, fontSize: 11 }}>
            ✓ {t('workbench.variables.panel.allResolved', { count: vars.length })}
          </Text>
        ) : (
          <Text style={{ color: token.colorError, fontSize: 11 }}>
            ⚠ {t('workbench.variables.panel.unresolvedCount', { count: vars.length - resolvedCount })}
          </Text>
        )}
      </div>

      {errors.length > 0 ? <ResolutionErrorList errors={errors} /> : null}
    </>
  );
}
