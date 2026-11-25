/**
 * WorkflowRunResponse — the exchange a call step of a run opens to, in
 * the request editor's own response views. Loaded when a step is first
 * opened: the workflow editor does not carry the response viewer.
 */

import type { ExecutedRequestSnapshot } from '@openheaders/core/types';
import { Tabs } from 'antd';
import type React from 'react';
import { useState } from 'react';
import ResponseErrorState from '../request-editor/response/ResponseErrorState';
import ResponseMetaStrip from '../request-editor/response/ResponseMetaStrip';
import { useResponseTabs } from '../request-editor/response/useResponseTabs';

const WorkflowRunResponse: React.FC<{ snapshot: ExecutedRequestSnapshot }> = ({ snapshot }) => {
  const [activeTab, setActiveTab] = useState('body');
  const tabItems = useResponseTabs(snapshot);

  // No response head arrived — there is nothing to tab through.
  if (snapshot.error !== null && snapshot.status === 0) {
    return (
      <ResponseErrorState
        error={snapshot.error}
        advice={snapshot.errorAdvice}
        hint={snapshot.errorHint}
        layout="horizontal"
      />
    );
  }
  return (
    <Tabs
      size="small"
      activeKey={tabItems.some((item) => item.key === activeTab) ? activeTab : 'body'}
      onChange={setActiveTab}
      className="rules-response-tabs"
      style={{ flex: 1, padding: '0 16px', display: 'flex', flexDirection: 'column', minHeight: 0 }}
      tabBarStyle={{ marginBottom: 0 }}
      tabBarExtraContent={{ right: <ResponseMetaStrip response={snapshot} /> }}
      items={tabItems}
    />
  );
};

export default WorkflowRunResponse;
