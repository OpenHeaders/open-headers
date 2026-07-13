/**
 * ResponseConsoleView — console output captured by the pre-request and
 * post-response scripts, grouped under section headers.
 */

import type { ScriptConsoleEntry } from '@openheaders/core/scripts';
import { Typography } from 'antd';
import type React from 'react';
import ScriptLogList from './ScriptLogList';

const { Text } = Typography;

const ResponseConsoleView: React.FC<{ preLog: ScriptConsoleEntry[]; postLog: ScriptConsoleEntry[] }> = ({
  preLog,
  postLog,
}) => (
  <div style={{ flex: 1, overflow: 'auto', overscrollBehavior: 'none', minHeight: 0, paddingTop: 4 }}>
    {preLog.length > 0 && (
      <>
        <Text strong style={{ fontSize: 11 }}>
          Pre-request
        </Text>
        <ScriptLogList entries={preLog} />
      </>
    )}
    {postLog.length > 0 && (
      <>
        <Text strong style={{ fontSize: 11 }}>
          Post-response
        </Text>
        <ScriptLogList entries={postLog} />
      </>
    )}
  </div>
);

export default ResponseConsoleView;
