/**
 * ResponsePanel — the response half of the request editor split.
 *
 * Always mounted (so the divider + layout toggle are reachable before
 * the first Send); shows an empty-state until a response arrives. With
 * a response, the whole header is ONE row — the tab bar itself: tabs
 * on the left, then meta strip, the "use response in workflow" action,
 * orientation toggle and a ⋯ menu (Copy / Save body, Clear response)
 * on the right. Each tab's body is its own view component
 * (Body · Headers · Cookies · Assertions · Console), the latter tabs
 * appearing only when the response carries that data.
 */

import {
  CheckOutlined,
  ClearOutlined,
  CopyOutlined,
  DownOutlined,
  DownloadOutlined,
  EllipsisOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useLiveWorkflows } from '@openheaders/ui/shared/hooks/readers/useLiveWorkflows';
import type { ExecutedRequestSnapshot } from '@openheaders/core/types';
import { Button, Dropdown, Tabs, Typography, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import type { RequestEditorLayout } from '../useRequestEditorLayout';
import ResponseAssertionsView from './ResponseAssertionsView';
import ResponseBodyView from './ResponseBodyView';
import ResponseConsoleView from './ResponseConsoleView';
import ResponseCookiesView from './ResponseCookiesView';
import ResponseEmptyState from './ResponseEmptyState';
import ResponseHeadersView from './ResponseHeadersView';
import ResponseMetaStrip from './ResponseMetaStrip';
import { detectBodyLanguage } from './response-format';
import { downloadBodyAsFile } from './response-save';
import { SplitLayoutToggle } from '@openheaders/ui/shared/split-layout';

const { Text } = Typography;

type ResponseTabKey = 'body' | 'headers' | 'cookies' | 'assertions' | 'script-log';

interface ResponsePanelProps {
  response: ExecutedRequestSnapshot | null;
  /** True while a Send is in flight — drives the "Sending…" empty state. */
  sending: boolean;
  /** Current split orientation — drives the active state of the toggle. */
  layout: RequestEditorLayout;
  /** Flip the request/response split orientation. */
  onLayoutChange: (next: RequestEditorLayout) => void;
  onClear: () => void;
  /**
   * "Use response in workflow" action — when provided, renders a
   * dropdown letting the user either create a new workflow draft with
   * this request seeded as step 1, or attach this request as a new step
   * to an existing workflow. Undefined when the request isn't yet
   * saved (no stable uid to reference).
   */
  onExtractToWorkflow?: (target: 'new' | { workflowUid: string }) => void;
}

const ResponsePanel: React.FC<ResponsePanelProps> = ({
  response,
  sending,
  layout,
  onLayoutChange,
  onClear,
  onExtractToWorkflow,
}) => {
  const { token } = theme.useToken();
  // Pull the list of existing workflows so the Extract dropdown can
  // offer "Attach to …" with a submenu of current workflows. Lightweight
  // — the hook already reads the same listener the sidebar uses.
  const { workflows: liveWorkflows } = useLiveWorkflows();
  const scripts = response?.scripts ?? null;
  const assertions = scripts?.postResponse?.assertions ?? [];
  const assertionsPassed = assertions.filter((a) => a.passed).length;
  const assertionsFailed = assertions.length - assertionsPassed;
  const preLog = scripts?.preRequest?.consoleLog ?? [];
  const postLog = scripts?.postResponse?.consoleLog ?? [];
  const hasScriptLog = preLog.length > 0 || postLog.length > 0;
  const setCookieCount = response?.wire?.setCookieHeaders?.length ?? 0;
  const [activeTab, setActiveTab] = useState<ResponseTabKey>('body');
  const [bodyCopied, setBodyCopied] = useState(false);

  const copyBody = () => {
    if (!response) return;
    void navigator.clipboard.writeText(response.body).then(() => {
      setBodyCopied(true);
      window.setTimeout(() => setBodyCopied(false), 1500);
    });
  };
  const saveBody = () => {
    if (!response) return;
    downloadBodyAsFile(response.body, response.url, detectBodyLanguage(response.headers));
  };

  const statusColor =
    !response || response.error !== null
      ? token.colorError
      : response.status >= 500
        ? token.colorError
        : response.status >= 400
          ? token.colorWarning
          : response.status >= 200 && response.status < 300
            ? token.colorSuccess
            : token.colorTextSecondary;

  return (
    <div
      className="rules-thin-scrollbar"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        minWidth: 0,
        background: token.colorBgContainer,
      }}
    >
      {!response ? (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 16px',
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <Text strong style={{ fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}>
              Response
            </Text>
            <div style={{ marginLeft: 'auto' }}>
              <SplitLayoutToggle layout={layout} onChange={onLayoutChange} />
            </div>
          </div>
          <ResponseEmptyState sending={sending} />
        </>
      ) : (
        <Tabs
          size="small"
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k as ResponseTabKey)}
          className="rules-response-tabs"
          style={{ flex: 1, padding: '0 16px', display: 'flex', flexDirection: 'column', minHeight: 0 }}
          tabBarStyle={{ marginBottom: 0 }}
          tabBarExtraContent={{
            right: (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, paddingLeft: 12 }}>
                <ResponseMetaStrip response={response} statusColor={statusColor} />
                {onExtractToWorkflow && !response.error && (
                  <Dropdown
                    trigger={['click']}
                    menu={{
                      items: [
                        {
                          key: 'new',
                          icon: <ThunderboltOutlined />,
                          label: 'Create new workflow',
                          onClick: () => onExtractToWorkflow('new'),
                        },
                        {
                          key: 'attach',
                          icon: <ThunderboltOutlined />,
                          label: 'Attach to existing workflow',
                          disabled: liveWorkflows.length === 0,
                          children:
                            liveWorkflows.length === 0
                              ? undefined
                              : liveWorkflows.map((w) => ({
                                  key: `attach-${w.uid}`,
                                  label: w.name,
                                  onClick: () => onExtractToWorkflow({ workflowUid: w.uid }),
                                })),
                        },
                      ],
                    }}
                  >
                    <Button size="small">
                      Use response in workflow <DownOutlined style={{ fontSize: 10 }} />
                    </Button>
                  </Dropdown>
                )}
                <SplitLayoutToggle layout={layout} onChange={onLayoutChange} />
                <Dropdown
                  trigger={['click']}
                  menu={{
                    items: [
                      {
                        key: 'copy',
                        icon: <CopyOutlined />,
                        label: 'Copy body',
                        disabled: !response.body,
                        onClick: copyBody,
                      },
                      {
                        key: 'save',
                        icon: <DownloadOutlined />,
                        label: response.bodyTruncated
                          ? 'Save body to file (truncated — saves what was kept)'
                          : 'Save body to file',
                        disabled: !response.body,
                        onClick: saveBody,
                      },
                      { type: 'divider' },
                      {
                        key: 'clear',
                        icon: <ClearOutlined />,
                        label: 'Clear response',
                        onClick: onClear,
                      },
                    ],
                  }}
                >
                  <Button
                    size="small"
                    type="text"
                    icon={bodyCopied ? <CheckOutlined /> : <EllipsisOutlined />}
                    aria-label="More response actions"
                  />
                </Dropdown>
              </div>
            ),
          }}
          items={[
            {
              key: 'body',
              label: 'Body',
              children: <ResponseBodyView response={response} />,
            },
            {
              key: 'headers',
              label: `Headers (${response.headers.length})`,
              children: <ResponseHeadersView headers={response.headers} />,
            },
            ...(setCookieCount > 0 && response.wire
              ? [
                  {
                    key: 'cookies' as ResponseTabKey,
                    label: `Cookies (${setCookieCount})`,
                    children: <ResponseCookiesView wire={response.wire} url={response.url} />,
                  },
                ]
              : []),
            ...(assertions.length > 0
              ? [
                  {
                    key: 'assertions' as ResponseTabKey,
                    label: `Assertions${assertionsFailed > 0 ? ` (${assertionsFailed} failed)` : assertionsPassed > 0 ? ` (${assertionsPassed} passed)` : ''}`,
                    children: <ResponseAssertionsView assertions={assertions} />,
                  },
                ]
              : []),
            ...(hasScriptLog
              ? [
                  {
                    key: 'script-log' as ResponseTabKey,
                    label: `Console (${preLog.length + postLog.length})`,
                    children: <ResponseConsoleView preLog={preLog} postLog={postLog} />,
                  },
                ]
              : []),
          ]}
        />
      )}
    </div>
  );
};

export default ResponsePanel;
