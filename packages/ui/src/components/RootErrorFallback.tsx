/**
 * RootErrorFallback — ring 1 of the containment design: what a document
 * shows when nothing below its root boundary could contain a failure.
 * Mounted ABOVE the providers, so it depends on nothing that may have
 * crashed: antd renders without a ConfigProvider and `useT` falls back
 * to the locale context's English default.
 *
 * Three ways on: reload the document, copy the details a bug report
 * needs, and — where the host registers `revealLogs` (desktop) — open
 * the log folder the funnel wrote to. No external link (the
 * no-external-redirects law).
 */

import { getCapability, hasCapability } from '@openheaders/core/capabilities';
import { Button, Result, Typography } from 'antd';
import type React from 'react';
import { useCallback, useState } from 'react';
import { useT } from '../context/LocaleContext';
import { formatErrorDetails } from '../shared/error-funnel';

interface RootErrorFallbackProps {
  error: Error;
}

const RootErrorFallback: React.FC<RootErrorFallbackProps> = ({ error }) => {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const canRevealLogs = hasCapability('revealLogs');

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
    <div style={{ padding: 24, minHeight: '100vh', boxSizing: 'border-box' }}>
      <Result
        status="error"
        title={t('shared.errorBoundary.title')}
        subTitle={t('shared.errorBoundary.rootSubtitle')}
        extra={[
          <Button key="reload" type="primary" onClick={() => window.location.reload()}>
            {t('shared.errorBoundary.reload')}
          </Button>,
          <Button key="copy" onClick={() => void copyDetails()}>
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
      >
        <Typography.Text type="secondary" code>
          {`${error.name}: ${error.message}`}
        </Typography.Text>
      </Result>
    </div>
  );
};

export default RootErrorFallback;
