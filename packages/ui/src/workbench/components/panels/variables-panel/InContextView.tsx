/**
 * "In Rule / Request / Template" view — the variables the focused entity
 * actually references, each resolved against every scope, plus a
 * resolved/unresolved summary and the structured resolution-error list.
 */

import type { ResolutionError } from '@openheaders/core/variables';
import { Empty, Typography, theme } from 'antd';
import type { DispatchVariable } from '../scope-editor-dispatch';
import { ResolutionErrorList } from './ResolutionErrorList';
import type { DisplayVariable, ScopeKind } from './types';
import { VariableRow } from './VariableRow';

const { Text } = Typography;

interface InContextViewProps {
  vars: DisplayVariable[];
  errors: ResolutionError[];
  scopeKind: ScopeKind;
  hasContext: boolean;
  openVariableEditor: (variable: DispatchVariable, name: string) => (() => void) | null;
}

export function InContextView({ vars, errors, scopeKind, hasContext, openVariableEditor }: InContextViewProps) {
  const { token } = theme.useToken();
  const noun = scopeKind === 'request' ? 'request' : scopeKind === 'template' ? 'template' : 'rule';
  if (!hasContext) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <Text type="secondary" style={{ fontSize: 11 }}>
            Open a {noun} to see the variables it references.
          </Text>
        }
      />
    );
  }
  if (vars.length === 0) {
    return (
      <Text type="secondary" style={{ fontSize: 11 }}>
        No variables referenced in this {noun}.
      </Text>
    );
  }
  const resolvedCount = vars.filter((v) => v.resolved).length;
  return (
    <>
      {vars.map((v) => (
        <VariableRow key={v.name} variable={v} onOpenEditor={openVariableEditor(v, v.name)} />
      ))}
      <div style={{ marginTop: 10, fontSize: 11 }}>
        {resolvedCount === vars.length ? (
          <Text style={{ color: token.colorSuccess, fontSize: 11 }}>
            ✓ All {vars.length} variable{vars.length !== 1 ? 's' : ''} resolved
          </Text>
        ) : (
          <Text style={{ color: token.colorError, fontSize: 11 }}>⚠ {vars.length - resolvedCount} unresolved</Text>
        )}
      </div>

      {errors.length > 0 ? <ResolutionErrorList errors={errors} /> : null}
    </>
  );
}
