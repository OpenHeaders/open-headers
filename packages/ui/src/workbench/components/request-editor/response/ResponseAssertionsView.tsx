/**
 * ResponseAssertionsView — pass/fail list for the assertions registered
 * by the post-response script (`oh.test(name, fn)`).
 */

import type { TestAssertion } from '@openheaders/core/scripts';
import { Tag, Typography } from 'antd';
import type React from 'react';

const { Text } = Typography;

const ResponseAssertionsView: React.FC<{ assertions: TestAssertion[] }> = ({ assertions }) => (
  <div style={{ flex: 1, overflow: 'auto', minHeight: 0, paddingTop: 4 }}>
    {assertions.map((a, idx) => (
      <div
        key={`${a.name}:${idx}`}
        style={{
          display: 'flex',
          gap: 8,
          fontSize: 12,
          padding: '4px 0',
          alignItems: 'flex-start',
        }}
      >
        <Tag color={a.passed ? 'success' : 'error'} style={{ marginInlineEnd: 0 }}>
          {a.passed ? 'PASS' : 'FAIL'}
        </Tag>
        <div style={{ flex: 1 }}>
          <Text>{a.name}</Text>
          {!a.passed && a.message && (
            <div>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {a.message}
              </Text>
            </div>
          )}
        </div>
        {typeof a.durationMs === 'number' && (
          <Text type="secondary" style={{ fontSize: 11 }}>
            {a.durationMs} ms
          </Text>
        )}
      </div>
    ))}
  </div>
);

export default ResponseAssertionsView;
