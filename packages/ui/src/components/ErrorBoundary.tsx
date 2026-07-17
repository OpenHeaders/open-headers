import { Button, Result } from 'antd';
import React from 'react';
import { LocaleContext } from '@openheaders/ui/context/LocaleContext';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // Class component — reads `t` off the context object. When mounted
  // above the LocaleProvider the context default (English) applies,
  // which is the right fallback for a crashed tree anyway.
  static contextType = LocaleContext;
  declare context: React.ContextType<typeof LocaleContext>;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error(
      new Date().toISOString(),
      'ERROR',
      '[ErrorBoundary]',
      'Error caught by ErrorBoundary:',
      error,
      errorInfo,
    );
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      const { t } = this.context;
      return (
        <div style={{ padding: '20px' }}>
          <Result
            status="error"
            title={t('shared.errorBoundary.title')}
            subTitle={t('shared.errorBoundary.subtitle')}
            extra={
              <Button type="primary" onClick={() => window.location.reload()}>
                {t('shared.errorBoundary.reload')}
              </Button>
            }
          />
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
