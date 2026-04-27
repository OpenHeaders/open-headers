/**
 * RuleSummary — plain-English summary of a rule for the import preview
 * (design §5.2).
 *
 * Pure render: consumes the structured `RuleSummary` produced by
 * `summarizeRule` in `@openheaders/core/workspace-export`. The core
 * helper carries the action verb, the matched-domain targets, the
 * concrete payload (header changes / redirect URL / inline-script
 * size / mock status), and any caveats (inject from URL, dynamic body,
 * CSP bypass) that fall out of the rule's shape.
 *
 * Untrusted-string discipline (§4.1 gate 10): every rule-supplied
 * string lands as a React text node — no `dangerouslySetInnerHTML`,
 * no markdown.
 */

import type { V5 } from '@openheaders/core/types';
import { summarizeRule } from '@openheaders/core/workspace-export';
import { Tag, Tooltip, Typography } from 'antd';
import type React from 'react';

const { Text } = Typography;

interface RuleSummaryProps {
  rule: V5.Rule;
}

const RuleSummary: React.FC<RuleSummaryProps> = ({ rule }) => {
  const summary = summarizeRule(rule);
  const visibleTargets = summary.targets.slice(0, 3);
  const hiddenTargets = summary.targets.length - visibleTargets.length;
  return (
    <div style={{ fontSize: 11, lineHeight: 1.4 }}>
      <Text type="secondary">
        {summary.verb} · <Text>{summary.payload}</Text>
      </Text>
      {summary.targets.length > 0 ? (
        <div style={{ marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {visibleTargets.map((t) => (
            <Tag key={t} style={{ fontSize: 10, marginRight: 0 }}>
              {t}
            </Tag>
          ))}
          {hiddenTargets > 0 && (
            <Tooltip title={summary.targets.slice(3).join(', ')}>
              <Tag style={{ fontSize: 10, marginRight: 0 }}>+{hiddenTargets} more</Tag>
            </Tooltip>
          )}
        </div>
      ) : (
        <div style={{ marginTop: 2 }}>
          <Tag color="orange" style={{ fontSize: 10 }}>
            fires on every request
          </Tag>
        </div>
      )}
      {summary.caveats.length > 0 && (
        <ul style={{ marginTop: 2, marginBottom: 0, paddingLeft: 16 }}>
          {summary.caveats.map((c) => (
            <li key={c}>
              <Text type="warning" style={{ fontSize: 11 }}>
                {c}
              </Text>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default RuleSummary;
