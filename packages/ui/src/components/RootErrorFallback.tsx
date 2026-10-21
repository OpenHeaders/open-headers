/**
 * RootErrorFallback — ring 1 of the containment design: what a document
 * shows when nothing below its root boundary could contain a failure.
 * Mounted ABOVE the providers, so it depends on nothing that may have
 * crashed: it resolves the appearance itself (`root-fallback-theme`)
 * and wraps its own `ConfigProvider`, so the page wears the app's
 * theme — the same variant, the same tokens — without the provider
 * tree; `useT` falls back to the locale context's English default.
 *
 * Three ways on: reload the document, report the issue, chat with us.
 * Report Issue opens the workbench's own report dialog, mounted here a
 * second time under this page's provider — the dialog leans on module
 * stores and the bridge, nothing from the tree that died — seeded with
 * the error as the title and the funnel's details as the description;
 * the dialog's Preview takes the person to GitHub to review and post.
 * The chat link is the sanctioned exception to the no-external-
 * redirects law (the user's word, 2026-10-20): a crashed window has no
 * in-app surface left.
 *
 * Reload is the primary way out and it must cost nothing: the crash is
 * recorded in session storage as the page shows, and the reloaded
 * document's timeline offers the same two actions from a working
 * window (`pending-crash`). The buttons read in sequence — report,
 * chat, then reload.
 */

import { BugOutlined, CloseCircleFilled, MessageOutlined } from '@ant-design/icons';
import { COMMUNITY_CHAT_URL } from '@openheaders/core/diagnostics';
import { App, Button, ConfigProvider, Result, Typography, theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo } from 'react';
import { useT } from '../context/LocaleContext';
import { formatErrorDetails, rememberPendingCrash } from '../shared/error-funnel';
import { openExternalLink } from '../shared/open-external';
import DownloadFeedbackToast from '../shared/notifications/DownloadFeedbackToast';
import ReportIssueDialog from '../workbench/support/ReportIssueDialog';
import { openReportIssueDialog } from '../workbench/support/store';
import { resolveRootFallbackTheme } from './root-fallback-theme';

interface RootErrorFallbackProps {
  error: Error;
}

const RootErrorPage: React.FC<RootErrorFallbackProps> = ({ error }) => {
  const t = useT();
  const { token } = theme.useToken();
  const headline = `${error.name}: ${error.message}`;
  const details = useMemo(
    () => formatErrorDetails({ surface: 'workbench', origin: 'render', error, componentStack: null }),
    [error],
  );

  useEffect(() => {
    rememberPendingCrash({ headline, details, at: Date.now() });
  }, [headline, details]);

  const report = (): void => {
    openReportIssueDialog('bug', { title: headline, description: details });
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        boxSizing: 'border-box',
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: token.colorBgLayout,
        color: token.colorText,
        fontFamily: token.fontFamily,
      }}
    >
      <Result
        status="error"
        icon={<CloseCircleFilled style={{ fontSize: 40 }} />}
        title={t('shared.errorBoundary.title')}
        subTitle={t('shared.errorBoundary.rootSubtitle')}
        extra={[
          <Button key="report" icon={<BugOutlined />} onClick={report}>
            {t('shared.errorBoundary.reportIssue')}
          </Button>,
          <Button key="chat" icon={<MessageOutlined />} onClick={() => openExternalLink(COMMUNITY_CHAT_URL)}>
            {t('shared.errorBoundary.communityChat')}
          </Button>,
          <Button key="reload" type="primary" onClick={() => window.location.reload()}>
            {t('shared.errorBoundary.reload')}
          </Button>,
        ]}
      />
      <Typography.Text type="secondary" code>
        {headline}
      </Typography.Text>
      <ReportIssueDialog />
      <DownloadFeedbackToast />
    </div>
  );
};

const RootErrorFallback: React.FC<RootErrorFallbackProps> = ({ error }) => {
  const { antTheme } = useMemo(resolveRootFallbackTheme, []);
  return (
    <ConfigProvider theme={antTheme}>
      {/* antd's App context, so the saved-bundle balloon has a notification host on a crashed window. */}
      <App component={false}>
        <RootErrorPage error={error} />
      </App>
    </ConfigProvider>
  );
};

export default RootErrorFallback;
