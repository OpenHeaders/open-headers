/**
 * Missing-deps panel — informational gate 7+8 of the import pipeline.
 * Never blocks the import; rules import as broken bindings (the user
 * rebinds once the missing entity appears).
 */

import { ExclamationCircleOutlined } from '@ant-design/icons';
import type { MissingDep } from '@openheaders/core/workspace-export';
import { Alert, Tag, Typography } from 'antd';
import type React from 'react';

const { Text } = Typography;

const MissingDepsPanel: React.FC<{ missingDeps: MissingDep[] }> = ({ missingDeps }) => (
  <Alert
    type="warning"
    showIcon
    icon={<ExclamationCircleOutlined />}
    title={`${missingDeps.length} unresolved reference${missingDeps.length === 1 ? '' : 's'}`}
    description={
      <ul style={{ margin: 0, paddingLeft: 20 }}>
        {missingDeps.slice(0, 8).map((d) => (
          <li key={`${d.type}:${d.name}`} style={{ fontSize: 11 }}>
            <Tag>{d.type}</Tag>
            <Text>{d.name}</Text>
            <Text type="secondary"> · referenced by {d.referencedBy.length}</Text>
          </li>
        ))}
        {missingDeps.length > 8 && (
          <li style={{ fontSize: 11 }}>
            <Text type="secondary">…and {missingDeps.length - 8} more</Text>
          </li>
        )}
      </ul>
    }
  />
);

export default MissingDepsPanel;
