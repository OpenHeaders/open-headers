/**
 * CollisionStrategyControl — per-entity strategy picker for the
 * import preview tree. The diff-time `allowedStrategies` list narrows
 * the dropdown to only the strategies that actually apply to this
 * entity type + collision state (design §2.1).
 */

import type { CollisionStrategy } from '@openheaders/core/workspace-export';
import { Select } from 'antd';
import type React from 'react';

interface CollisionStrategyControlProps {
  value: CollisionStrategy;
  allowed: readonly CollisionStrategy[];
  onChange: (next: CollisionStrategy) => void;
  disabled?: boolean;
  size?: 'small' | 'middle';
}

const STRATEGY_LABEL: Record<CollisionStrategy, string> = {
  'new-uid': 'Create new copy',
  update: 'Update existing',
  skip: 'Skip',
  'merge-by-name': 'Merge by name',
  replace: 'Replace',
  'merge-vars': 'Merge variables',
  'merge-children': 'Merge children',
};

const CollisionStrategyControl: React.FC<CollisionStrategyControlProps> = ({
  value,
  allowed,
  onChange,
  disabled,
  size = 'small',
}) => (
  <Select
    size={size}
    value={value}
    disabled={disabled}
    onChange={onChange}
    style={{ width: 160 }}
    options={allowed.map((s) => ({ label: STRATEGY_LABEL[s], value: s }))}
  />
);

export default CollisionStrategyControl;
