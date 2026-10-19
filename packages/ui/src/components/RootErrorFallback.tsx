/**
 * RootErrorFallback — ring 1 of the containment design: what a document
 * shows when nothing below its root boundary could contain a failure.
 * Mounted ABOVE the providers, so it depends on nothing that may have
 * crashed: it resolves the appearance itself (`root-fallback-theme`)
 * and wraps its own `ConfigProvider`, so the page wears the app's
 * theme — the same variant, the same tokens — without the provider
 * tree; `useT` falls back to the locale context's English default.
 *
 * Three ways on: reload the document, copy the details a bug report
 * needs, and — where the host registers `revealLogs` (desktop) — open
 * the log folder the funnel wrote to. No external link (the
 * no-external-redirects law).
 */

import { CheckOutlined } from '@ant-design/icons';
import { getCapability, hasCapability } from '@openheaders/core/capabilities';
import { Button, ConfigProvider, Result, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useT } from '../context/LocaleContext';
import { formatErrorDetails } from '../shared/error-funnel';
import { resolveRootFallbackTheme } from './root-fallback-theme';

interface RootErrorFallbackProps {
  error: Error;
}

/** How long Copy details reads as copied before it offers again. */
export const COPIED_FEEDBACK_MS = 1500;

const RootErrorPage: React.FC<RootErrorFallbackProps> = ({ error }) => {
  const t = useT();
  const { token } = theme.useToken();
  const [copied, setCopied] = useState(false);
  const canRevealLogs = hasCapability('revealLogs');

  useEffect(() => {
    if (!copied) return;
    const handle = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    return () => clearTimeout(handle);
  }, [copied]);

  const copyDetails = useCallback(async () => {
    const text = formatErrorDetails({ surface: 'workbench', origin: 'render', error, componentStack: null });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }, [error]);

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
        title={t('shared.errorBoundary.title')}
        subTitle={t('shared.errorBoundary.rootSubtitle')}
        extra={[
          <Button key="reload" type="primary" onClick={() => window.location.reload()}>
            {t('shared.errorBoundary.reload')}
          </Button>,
          <Button
            key="copy"
            icon={copied ? <CheckOutlined style={{ color: token.colorSuccess }} /> : undefined}
            onClick={() => void copyDetails()}
          >
            {copied ? t('shared.toast.copiedToClipboard') : t('shared.errorBoundary.copyDetails')}
          </Button>,
          ...(canRevealLogs
            ? [
                <Button key="logs" onClick={() => void getCapability('revealLogs')?.()}>
                  {t('shared.errorBoundary.openLogs')}
                </Button>,
              ]
            : []),
        ]}
      />
      <Typography.Text type="secondary" code>
        {`${error.name}: ${error.message}`}
      </Typography.Text>
    </div>
  );
};

const RootErrorFallback: React.FC<RootErrorFallbackProps> = ({ error }) => {
  const { antTheme } = useMemo(resolveRootFallbackTheme, []);
  return (
    <ConfigProvider theme={antTheme}>
      <RootErrorPage error={error} />
    </ConfigProvider>
  );
};

export default RootErrorFallback;
