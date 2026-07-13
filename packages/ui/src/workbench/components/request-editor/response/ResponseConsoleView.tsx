/**
 * ResponseConsoleView — console output captured by the pre-request and
 * post-response scripts, grouped under section headers.
 */

import type { ScriptConsoleEntry } from '@openheaders/core/scripts';
import { Typography } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import ScriptLogList from './ScriptLogList';

const { Text } = Typography;

const ResponseConsoleView: React.FC<{ preLog: ScriptConsoleEntry[]; postLog: ScriptConsoleEntry[] }> = ({
  preLog,
  postLog,
}) => {
  const t = useT();
  return (
    <div style={{ flex: 1, overflow: 'auto', overscrollBehavior: 'none', minHeight: 0, paddingTop: 4 }}>
      {preLog.length > 0 && (
        <>
          <Text strong style={{ fontSize: 11 }}>
            {t('workbench.editors.request.response.console.preRequest')}
          </Text>
          <ScriptLogList entries={preLog} />
        </>
      )}
      {postLog.length > 0 && (
        <>
          <Text strong style={{ fontSize: 11 }}>
            {t('workbench.editors.request.response.console.postResponse')}
          </Text>
          <ScriptLogList entries={postLog} />
        </>
      )}
    </div>
  );
};

export default ResponseConsoleView;
