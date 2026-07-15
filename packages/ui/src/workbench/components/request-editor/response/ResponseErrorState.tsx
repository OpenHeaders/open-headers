/**
 * Error state for a failed send — there is no wire response to tab
 * through, so the pane explains the failure instead of mounting an
 * empty Body/Headers tab set with the error crammed into the header.
 * Mirrors ResponseEmptyState's centered grey-icon layout so the two
 * placeholder states read as one family.
 *
 * Certificate rejections (`open-in-tab` hint) additionally render the
 * CertTrustSteps walkthrough — open in tab → accept warning → resend —
 * laid out to match the pane's shape: a stacked editor split gives a
 * wide pane (steps in a row), a side-by-side split a narrow one
 * (steps stacked).
 */

import { DisconnectOutlined } from '@ant-design/icons';
import type { ExecutedRequestErrorHint } from '@openheaders/core/types';
import { Typography, theme } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import type { RequestEditorLayout } from '../useRequestEditorLayout';
import CertTrustSteps from './CertTrustSteps';

const { Text } = Typography;

const ResponseErrorState: React.FC<{
  error: string;
  hint?: ExecutedRequestErrorHint;
  layout: RequestEditorLayout;
}> = ({ error, hint, layout }) => {
  const { token } = theme.useToken();
  const t = useT();
  return (
    <div
      className="rules-thin-scrollbar"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        minHeight: 0,
        padding: 24,
        textAlign: 'center',
        overflowY: 'auto',
      }}
    >
      <DisconnectOutlined style={{ fontSize: 20, color: token.colorTextQuaternary }} />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <Text strong style={{ fontSize: 12 }}>
          {t('workbench.editors.request.response.error.title')}
        </Text>
        {hint?.netError !== undefined && (
          <Text
            type="secondary"
            style={{
              fontSize: 11,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            }}
          >
            {`(${hint.netError})`}
          </Text>
        )}
      </div>
      {hint?.netError !== undefined ? (
        // Wire-confirmed certificate rejection: the code rides beside
        // the title, so the prose collapses to one actionable line —
        // the steps below carry the walkthrough.
        <Text type="secondary" style={{ fontSize: 12 }} data-testid="oh-response-error">
          {t('workbench.editors.request.response.error.certSteps.summary')}
        </Text>
      ) : (
        <Text type="secondary" style={{ fontSize: 12, maxWidth: 460 }} data-testid="oh-response-error">
          {error}
        </Text>
      )}
      {hint?.kind === 'open-in-tab' && (
        // Split vocabulary: layout 'vertical' stacks the panes, so the
        // response pane spans the editor's width → steps fit in a row;
        // 'horizontal' puts the panes side-by-side → stack the steps.
        <CertTrustSteps url={hint.url} direction={layout === 'vertical' ? 'horizontal' : 'vertical'} />
      )}
    </div>
  );
};

export default ResponseErrorState;
