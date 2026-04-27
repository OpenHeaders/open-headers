/**
 * RuleSummary — one-line plain-language summary of a rule for the
 * import preview (design §5.2).
 *
 * Placeholder for PR 2D — we render a terse summary based on the rule
 * type and condition counts. The full plain-English explainer
 * (Inspector docs panel reuse) lands in PR 5.
 *
 * Untrusted-string discipline (§4.1 gate 10): all rule-supplied fields
 * (`name`, `headerName`, `redirectTo`) render as React text nodes —
 * never `dangerouslySetInnerHTML`, never markdown.
 */

import type { V5 } from '@openheaders/core/types';
import { Typography } from 'antd';
import type React from 'react';

const { Text } = Typography;

interface RuleSummaryProps {
  rule: V5.Rule;
}

const RULE_VERB: Record<V5.Rule['type'], string> = {
  header: 'Modify headers',
  redirect: 'Redirect requests',
  body: 'Rewrite response body',
  inject: 'Inject script or CSS',
  block: 'Block requests',
  delay: 'Delay requests',
  mock: 'Mock response',
  'query-param': 'Modify query parameters',
};

function detail(rule: V5.Rule): string {
  switch (rule.type) {
    case 'header': {
      const total = rule.action.requestHeaders.length + rule.action.responseHeaders.length;
      return total === 1 ? '1 header change' : `${total} header changes`;
    }
    case 'redirect':
      return `→ ${rule.action.redirectTo}`;
    case 'inject':
      return rule.action.injectType === 'script' ? 'script' : 'css';
    case 'delay':
      return `${rule.action.delayMs}ms`;
    default:
      return '';
  }
}

const RuleSummary: React.FC<RuleSummaryProps> = ({ rule }) => {
  const conditionCount = rule.conditions.length;
  const det = detail(rule);
  const conds = conditionCount === 1 ? '1 condition' : `${conditionCount} conditions`;
  return (
    <Text type="secondary" style={{ fontSize: 11 }}>
      {RULE_VERB[rule.type]} · {conds}
      {det ? ` · ${det}` : ''}
    </Text>
  );
};

export default RuleSummary;
