/**
 * ResponsePanel — the response half of the request editor split.
 *
 * Always mounted (so the divider + layout toggle are reachable before
 * the first Send); shows an empty-state until a response arrives. This
 * module owns the header (status/timing meta, the "use response in
 * workflow" action, Clear, orientation toggle) and assembles the tab
 * set; each tab's body is its own view component (Body · Headers ·
 * Assertions · Console), with Assertions + Console appearing only when
 * the response carries that data.
 */

import { DownOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useLiveWorkflows } from '@openheaders/ui/shared/hooks/readers/useLiveWorkflows';
import type { ExecutedRequestSnapshot } from '@openheaders/core/types';
import { Button, Dropdown, Tabs, Typography, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import type { RequestEditorLayout } from '../useRequestEditorLayout';
import ResponseAssertionsView from './ResponseAssertionsView';
import ResponseBodyView from './ResponseBodyView';
import ResponseConsoleView from './ResponseConsoleView';
import ResponseEmptyState from './ResponseEmptyState';
import ResponseHeadersView from './ResponseHeadersView';
import ResponseMetaStrip from './ResponseMetaStrip';
import { SplitLayoutToggle } from '@openheaders/ui/shared/split-layout';

const { Text } = Typography;

type ResponseTabKey = 'body' | 'headers' | 'assertions' | 'script-log';

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
  const [activeTab, setActiveTab] = useState<ResponseTabKey>('body');

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
      {/* Header wraps as a whole — left meta group + right action group,
        each nowrap — so in a narrow side-by-side pane the actions reflow
        to a second line instead of the label collapsing to one glyph
        per line. */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
          rowGap: 6,
          padding: '6px 16px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <Text strong style={{ fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}>
            Response
          </Text>
          {response && <ResponseMetaStrip response={response} statusColor={statusColor} />}
        </div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
            gap: 8,
            rowGap: 6,
            marginLeft: 'auto',
          }}
        >
          {response && onExtractToWorkflow && !response.error && (
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
          {response && (
            <Button size="small" type="text" onClick={onClear}>
              Clear
            </Button>
          )}
          <SplitLayoutToggle layout={layout} onChange={onLayoutChange} />
        </div>
      </div>
      {!response ? (
        <ResponseEmptyState sending={sending} />
      ) : (
        <Tabs
          size="small"
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k as ResponseTabKey)}
          className="rules-response-tabs"
          style={{ flex: 1, padding: '0 16px', display: 'flex', flexDirection: 'column', minHeight: 0 }}
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
