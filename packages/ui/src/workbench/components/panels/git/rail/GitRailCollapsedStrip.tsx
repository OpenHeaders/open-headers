/**
 * GitRailCollapsedStrip — the hidden-branches state of the rail
 *: a narrow vertical bar carrying a `>` chevron and the
 * rotated "Branches" label. The whole strip is one button — hover
 * greys it, clicking brings section #1 back.
 */

import { RightOutlined } from '@ant-design/icons';
import { theme, Tooltip } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { GIT_RAIL_STRIP_WIDTH } from '../git-log-layout';
import { GIT_CARET_SIZE, GIT_TEXT_SIZE } from '../git-type-scale';

export interface GitRailCollapsedStripProps {
  onExpand: () => void;
}

const GitRailCollapsedStrip: React.FC<GitRailCollapsedStripProps> = ({ onExpand }) => {
  const { token } = theme.useToken();
  const t = useT();
  const [hovered, setHovered] = useState(false);

  return (
    <Tooltip placement="right" title={t('workbench.gitLog.rail.show')}>
      <button
        type="button"
        aria-label={t('workbench.gitLog.rail.show')}
        onClick={onExpand}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        data-testid="git-tool-rail-strip"
        style={{
          flex: '0 0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          width: GIT_RAIL_STRIP_WIDTH,
          padding: '8px 0',
          border: 'none',
          borderRight: `1px solid ${token.colorBorderSecondary}`,
          background: hovered ? token.colorFillTertiary : token.colorFillQuaternary,
          cursor: 'pointer',
          color: token.colorTextSecondary,
        }}
      >
        <RightOutlined style={{ fontSize: GIT_CARET_SIZE, flexShrink: 0 }} />
        <span
          style={{
            writingMode: 'vertical-lr',
            fontSize: GIT_TEXT_SIZE,
            letterSpacing: 0.3,
            whiteSpace: 'nowrap',
          }}
        >
          {t('workbench.gitLog.rail.branchesStrip')}
        </span>
      </button>
    </Tooltip>
  );
};

export default GitRailCollapsedStrip;
