/**
 * ResponsePanel — the response half of the request editor split.
 *
 * Always mounted (so the divider + orientation menu are reachable
 * before the first Send); shows an empty-state until a response
 * arrives. With a response, the whole header is ONE row — the tab bar
 * itself: tabs on the left, then meta strip, the "use response in
 * workflow" action and a ⋯ menu (Copy / Save body, Clear response,
 * split orientation) on the right. Each tab's body is its own view component
 * (Body · Headers · Cookies · Assertions · Console), the latter tabs
 * appearing only when the response carries that data.
 */

import {
  CheckOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownOutlined,
  DownloadOutlined,
  EllipsisOutlined,
  SisternodeOutlined,
} from '@ant-design/icons';
import { useLiveWorkflows } from '@openheaders/ui/shared/hooks/readers/useLiveWorkflows';
import type { ExecutedRequestSnapshot, LiveWorkflow } from '@openheaders/core/types';
import { Button, Dropdown, Tabs, Tooltip, Typography, theme } from 'antd';
import { ExampleChip } from '../../shared/ExampleChip';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { noteFeatureUsed } from '@openheaders/ui/shared/product-telemetry';
import type { RequestEditorLayout } from '../useRequestEditorLayout';
import type { LiveSendStream, SseStreamSession } from '../useLiveSendStream';
import ResponseEmptyState from './ResponseEmptyState';
import ResponseErrorState from './ResponseErrorState';
import ResponseHeadersView from './ResponseHeadersView';
import ResponseLiveMetaStrip from './ResponseLiveMetaStrip';
import ResponseLiveTail from './ResponseLiveTail';
import ResponseMetaStrip from './ResponseMetaStrip';
import SendPulse from './SendPulse';
import type { GraphqlResponseFacts } from './graphql-response';
import { detectBodyLanguage } from './response-format';
import { downloadBodyAsFile } from './response-save';
import { useSplitLayoutMenuItems } from '@openheaders/ui/shared/split-layout';
import { type ResponseTabKey, useResponseTabs } from './useResponseTabs';

const { Text } = Typography;

/**
 * "Create workflow" — seeds a live-workflow step from this request so
 * response values can be captured into `{{live.*}}` variables. The
 * action needs only a SAVED request (a stable uid to reference), not a
 * response — so it's offered before the first Send too. On unsaved
 * drafts the host renders the disabled variant below instead.
 */
const CreateWorkflowDropdown: React.FC<{
  onExtractToWorkflow: (target: 'new' | { workflowUid: string }) => void;
  liveWorkflows: LiveWorkflow[];
}> = ({ onExtractToWorkflow, liveWorkflows }) => {
  const t = useT();
  return (
    <Dropdown
      trigger={['click']}
      menu={{
        items: [
          {
            key: 'new',
            label: t('workbench.editors.request.response.createWorkflowNew'),
            onClick: () => onExtractToWorkflow('new'),
          },
          {
            key: 'attach',
            label: t('workbench.editors.request.response.createWorkflowAttach'),
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
      <Button size="small" icon={<SisternodeOutlined />}>
        {t('workbench.editors.request.response.createWorkflow')} <DownOutlined style={{ fontSize: 10 }} />
      </Button>
    </Dropdown>
  );
};

/** Draft-tab placeholder for the action above — a workflow step needs
 *  a persisted request uid to reference. Wrapper span keeps the
 *  tooltip alive over the disabled button. */
const CreateWorkflowNeedsSave: React.FC = () => {
  const t = useT();
  return (
    <Tooltip title={t('workbench.editors.request.response.createWorkflowNeedsSave')} placement="bottom">
      <span style={{ display: 'inline-flex', cursor: 'not-allowed' }}>
        <Button size="small" icon={<SisternodeOutlined />} disabled>
          {t('workbench.editors.request.response.createWorkflow')} <DownOutlined style={{ fontSize: 10 }} />
        </Button>
      </span>
    </Tooltip>
  );
};

interface ResponsePanelProps {
  response: ExecutedRequestSnapshot | null;
  /** True while a Send is in flight — drives the "Sending…" empty state. */
  sending: boolean;
  /**
   * Live-tail feed of the in-flight send (head + body received so
   * far). Non-null only while frames are arriving — the pane shows the
   * stream live instead of "Sending…"; the materialized snapshot takes
   * over when the send settles.
   */
  live?: LiveSendStream | null;
  /**
   * Session-only SSE stream timing retained by the editor after a live
   * send settles — the event list joins its timestamps onto the
   * materialized snapshot. Absent for non-SSE sends and re-opened
   * saved bodies.
   */
  sseSession?: SseStreamSession | null;
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
  /**
   * "Save Response" — snapshot the current exchange as a frozen example
   * under the request. Undefined on draft (request-create) tabs: an
   * example needs a persisted parent request to nest under, so the user
   * saves the request first.
   */
  onSaveResponse?: () => void;
  /**
   * Draft (request-create) tabs: `onExtractToWorkflow` is unavailable
   * (no persisted uid to reference), but the action stays visible as a
   * disabled button whose tooltip explains that saving unlocks it.
   */
  extractRequiresSave?: boolean;
  /** Resend the request — the error state's trust gesture retries through it. */
  onResend?: () => void;
  /** A GraphQL send's answer facts (`errors[]`, `extensions`) for the
   *  meta strip's tags — derived by the GraphQL editor, absent for an
   *  HTTP send. */
  graphql?: GraphqlResponseFacts | null;
}

const ResponsePanel: React.FC<ResponsePanelProps> = ({
  response,
  sending,
  live,
  sseSession,
  layout,
  onLayoutChange,
  onClear,
  onExtractToWorkflow,
  onSaveResponse,
  extractRequiresSave,
  onResend,
  graphql,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  // Pull the list of existing workflows so the Extract dropdown can
  // offer "Attach to …" with a submenu of current workflows. Lightweight
  // — the hook already reads the same listener the sidebar uses.
  const { workflows: liveWorkflows } = useLiveWorkflows();
  const tabItems = useResponseTabs(response, sseSession);
  const [activeTab, setActiveTab] = useState<ResponseTabKey>('body');
  const [bodyCopied, setBodyCopied] = useState(false);
  const layoutMenuItems = useSplitLayoutMenuItems(layout, onLayoutChange);

  // Product telemetry: the panel is always mounted (empty state before
  // the first Send), so "used" means a response actually rendered.
  useEffect(() => {
    if (response) noteFeatureUsed('response-panel');
  }, [response]);

  const copyBody = () => {
    if (!response) return;
    void navigator.clipboard.writeText(response.body).then(() => {
      setBodyCopied(true);
      window.setTimeout(() => setBodyCopied(false), 1500);
    });
  };
  const saveBody = () => {
    if (!response) return;
    downloadBodyAsFile(response, detectBodyLanguage(response.headers));
  };


  return (
    <div
      className="rules-thin-scrollbar"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        minWidth: 0,
        position: 'relative',
        background: token.colorBgContainer,
      }}
    >
      <SendPulse sending={sending} response={response} live={live} layout={layout} graphql={graphql} />
      {sending && live != null && live.head !== null ? (
        // Live phase — the SAME tab chrome as a settled response (the
        // Postman posture): Body streams the tail / event list, Headers
        // shows the head's fields already, and the tab-bar right slot
        // carries the live meta facts (pulsing dot · status · ticking
        // elapsed · bytes so far) right where the settled strip lands.
        <Tabs
          size="small"
          activeKey={activeTab === 'headers' ? 'headers' : 'body'}
          onChange={(k) => setActiveTab(k as ResponseTabKey)}
          className="rules-response-tabs"
          style={{ flex: 1, padding: '0 16px', display: 'flex', flexDirection: 'column', minHeight: 0 }}
          tabBarStyle={{ marginBottom: 0 }}
          tabBarExtraContent={{
            right: (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, paddingLeft: 12 }}>
                <ResponseLiveMetaStrip live={live} />
                <Dropdown trigger={['click']} menu={{ items: layoutMenuItems }} styles={{ root: { minWidth: 220 } }}>
                  <Button
                    size="small"
                    type="text"
                    icon={<EllipsisOutlined />}
                    aria-label={t('workbench.editors.request.response.moreActionsAria')}
                  />
                </Dropdown>
              </div>
            ),
          }}
          items={[
            {
              key: 'body',
              label: t('workbench.editors.request.response.tab.body'),
              children: <ResponseLiveTail live={live} />,
            },
            {
              key: 'headers',
              label: t('workbench.editors.request.response.tab.headers', { count: live.head.headers.length }),
              children: <ResponseHeadersView headers={live.head.headers} />,
            },
          ]}
        />
      ) : !response || response.error !== null ? (
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
              {t('workbench.editors.request.response.title')}
            </Text>
            <div style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {onExtractToWorkflow ? (
                <CreateWorkflowDropdown onExtractToWorkflow={onExtractToWorkflow} liveWorkflows={liveWorkflows} />
              ) : extractRequiresSave ? (
                <CreateWorkflowNeedsSave />
              ) : null}
              {response && (
                <Button size="small" type="text" icon={<DeleteOutlined />} onClick={onClear}>
                  {t('workbench.editors.request.response.clear')}
                </Button>
              )}
              <Dropdown trigger={['click']} menu={{ items: layoutMenuItems }} styles={{ root: { minWidth: 220 } }}>
                <Button
                  size="small"
                  type="text"
                  icon={<EllipsisOutlined />}
                  aria-label={t('workbench.editors.request.response.moreActionsAria')}
                />
              </Dropdown>
            </div>
          </div>
          {/* While a retry is in flight, the pane goes back to "Sending…"
              instead of leaving the stale failure on screen; once the
              head frame arrives the live tab chrome above takes over. */}
          {response && !sending ? (
            <ResponseErrorState
              error={response.error ?? ''}
              advice={response.errorAdvice}
              hint={response.errorHint}
              layout={layout}
              onResend={onResend}
            />
          ) : (
            <ResponseEmptyState sending={sending} />
          )}
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
                <ResponseMetaStrip response={response} graphql={graphql} />
                {onExtractToWorkflow ? (
                  <CreateWorkflowDropdown onExtractToWorkflow={onExtractToWorkflow} liveWorkflows={liveWorkflows} />
                ) : extractRequiresSave ? (
                  <CreateWorkflowNeedsSave />
                ) : null}
                <Dropdown
                  trigger={['click']}
                  styles={{ root: { minWidth: 220 } }}
                  menu={{
                    items: [
                      // Save Response leads — the one action that mints a
                      // durable artifact (a frozen example) rather than a
                      // body utility.
                      ...(onSaveResponse
                        ? [
                            {
                              key: 'save-response',
                              icon: <ExampleChip />,
                              label: t('workbench.editors.request.response.saveResponse'),
                              disabled: sending,
                              onClick: onSaveResponse,
                            },
                            { type: 'divider' as const },
                          ]
                        : []),
                      {
                        key: 'copy',
                        icon: <CopyOutlined />,
                        label: t('workbench.editors.request.response.copyBody'),
                        disabled: !response.body,
                        onClick: copyBody,
                      },
                      {
                        key: 'save',
                        icon: <DownloadOutlined />,
                        label: response.bodyTruncated
                          ? t('workbench.editors.request.response.saveBodyToFileTruncated')
                          : t('workbench.editors.request.response.saveBodyToFile'),
                        disabled: !response.body,
                        onClick: saveBody,
                      },
                      { type: 'divider' },
                      {
                        key: 'clear',
                        icon: <DeleteOutlined />,
                        label: t('workbench.editors.request.response.clearResponse'),
                        onClick: onClear,
                      },
                      { type: 'divider' },
                      ...layoutMenuItems,
                    ],
                  }}
                >
                  <Button
                    size="small"
                    type="text"
                    icon={bodyCopied ? <CheckOutlined /> : <EllipsisOutlined />}
                    aria-label={t('workbench.editors.request.response.moreActionsAria')}
                  />
                </Dropdown>
              </div>
            ),
          }}
          items={tabItems}
        />
      )}
    </div>
  );
};

export default ResponsePanel;
