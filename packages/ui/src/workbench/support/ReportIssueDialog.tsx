/**
 * ReportIssueDialog — the Report Issue / Feature Request surface
 * behind the desktop Help menu, Settings › About and the notifications
 * timeline's seed card, on every surface that seeds it (the error
 * reports plan §8.7). Two inputs whatever the kind — a title and one
 * description, the VS Code reporter's shape. The person sees the
 * system facts a bug report will carry (every row, behind "show"), and
 * "Preview on GitHub" opens the repository's new-issue page with the
 * title and the composed body prefilled from the URL — GitHub posts
 * only after the person reviews and submits there. No token, no upload: the app opens a link.
 *
 * Only the `diagnosticsFacts` answer rides the link; logs never do —
 * the line under the facts points at the diagnostic bundle, with its
 * Save button beside it. A host that does not answer the facts (a
 * served web tab) gets no checkbox and leaves the version and platform
 * lines for the person to fill on GitHub.
 */

import { hostBridge } from '@openheaders/core/bridge';
import { getCapability } from '@openheaders/core/capabilities';
import {
  type DiagnosticsFacts,
  type IssueDraft,
  type IssueKind,
  issueLink,
  systemInformationRows,
} from '@openheaders/core/diagnostics';
import { Button, Checkbox, Input, Modal, Segmented, Typography, theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { getCurrentHost } from '../../shared/host-vocabulary';
import { saveDiagnosticsBundle } from '../settings/diagnostics-bundle';
import { closeReportIssueDialog, useReportIssueDialog } from './store';

const { TextArea } = Input;
const { Text } = Typography;

const LINK_STYLE: React.CSSProperties = { padding: 0, height: 'auto', fontSize: 'inherit' };

const ReportIssueDialog: React.FC = () => {
  const t = useT();
  const { token } = theme.useToken();
  const { open, kind: openedKind } = useReportIssueDialog();
  const [kind, setKind] = useState<IssueKind>(openedKind);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [facts, setFacts] = useState<DiagnosticsFacts | null>(null);
  const [includeFacts, setIncludeFacts] = useState(true);
  const [showFacts, setShowFacts] = useState(false);

  // Each opening starts a fresh draft on the kind the entry chose and
  // re-reads the facts — the window count or the GPU table may have
  // changed since the last report.
  useEffect(() => {
    if (!open) return;
    setKind(openedKind);
    setTitle('');
    setDescription('');
    setIncludeFacts(true);
    setShowFacts(false);
    setFacts(null);
    let cancelled = false;
    hostBridge
      .call('diagnosticsFacts')
      .then((answer) => {
        if (!cancelled) setFacts(answer.facts);
      })
      .catch(() => {
        // A host without the RPC — the form leaves the version and platform to the person.
      });
    return () => {
      cancelled = true;
    };
  }, [open, openedKind]);

  const host = getCurrentHost();
  const draft = useMemo<IssueDraft>(() => ({ kind, title, description }), [kind, title, description]);
  const link = useMemo(
    () => issueLink(draft, host, includeFacts ? facts : null),
    [draft, host, includeFacts, facts],
  );
  const rows = useMemo(() => (facts ? systemInformationRows(facts) : []), [facts]);

  const preview = (): void => {
    const openUrl = getCapability('openExternalUrl');
    if (openUrl) void openUrl(link.url);
    else window.open(link.url, '_blank', 'noopener');
    closeReportIssueDialog();
  };

  const fieldLabel = (text: string, hint?: string): React.ReactNode => (
    <div style={{ marginBottom: 4 }}>
      <div style={{ fontSize: 12, color: token.colorTextSecondary }}>{text}</div>
      {hint ? <div style={{ fontSize: 12, color: token.colorTextTertiary }}>{hint}</div> : null}
    </div>
  );

  const factsNote = (() => {
    if (link.overBudget) return t('workbench.support.overBudget');
    if (link.trimmed === 'facts') return t('workbench.support.trimmed.facts');
    if (link.trimmed !== 'none') return t('workbench.support.trimmed.rows');
    return null;
  })();

  return (
    <Modal
      open={open}
      onCancel={closeReportIssueDialog}
      centered
      width={600}
      // The body scrolls under a viewport cap (the What's New idiom) so
      // the dialog never outgrows the window and the document never
      // grows a scrollbar of its own.
      styles={{ body: { maxHeight: '65vh', overflowY: 'auto', overscrollBehavior: 'contain' } }}
      title={kind === 'bug' ? t('workbench.support.title.bug') : t('workbench.support.title.feature')}
      footer={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text type="secondary" style={{ fontSize: 12, flex: 1, textAlign: 'left' }}>
            {t('workbench.support.previewHint')}
          </Text>
          <Button onClick={closeReportIssueDialog}>{t('shared.action.cancel')}</Button>
          <Button type="primary" disabled={link.overBudget} onClick={preview}>
            {t('workbench.support.preview')}
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
        <Segmented<IssueKind>
          value={kind}
          onChange={setKind}
          options={[
            { value: 'bug', label: t('workbench.support.kind.bug') },
            { value: 'feature', label: t('workbench.support.kind.feature') },
          ]}
        />
        <div>
          {fieldLabel(t('workbench.support.field.title'))}
          <Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} />
        </div>
        <div>
          {kind === 'bug'
            ? fieldLabel(t('workbench.support.field.steps'), t('workbench.support.field.steps.hint'))
            : fieldLabel(t('workbench.support.field.description'), t('workbench.support.field.description.hint'))}
          <TextArea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            autoSize={{ minRows: 6, maxRows: 14 }}
          />
        </div>
        {kind === 'bug' ? (
          <>
            {facts ? (
              <div>
                <Checkbox checked={includeFacts} onChange={(event) => setIncludeFacts(event.target.checked)}>
                  {t('workbench.support.facts.include')}
                </Checkbox>{' '}
                <Button type="link" size="small" style={LINK_STYLE} onClick={() => setShowFacts((shown) => !shown)}>
                  {showFacts ? t('workbench.support.facts.hide') : t('workbench.support.facts.show')}
                </Button>
                {showFacts ? (
                  // A bordered box of its own height: the GPU table alone is
                  // dozens of rows, and it must not swallow the fields.
                  <div
                    style={{
                      marginTop: 8,
                      maxHeight: 200,
                      overflowY: 'auto',
                      border: `1px solid ${token.colorBorderSecondary}`,
                      borderRadius: token.borderRadiusSM,
                      background: token.colorFillQuaternary,
                      padding: '0 8px',
                    }}
                  >
                    <table
                      style={{
                        width: '100%',
                        fontSize: 12,
                        borderCollapse: 'collapse',
                        color: includeFacts ? token.colorText : token.colorTextDisabled,
                      }}
                    >
                      <tbody>
                        {rows.map((row, index) => (
                          <tr
                            key={row.label}
                            style={index > 0 ? { borderTop: `1px solid ${token.colorBorderSecondary}` } : undefined}
                          >
                            <td style={{ padding: '3px 8px 3px 0', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                              {row.label}
                            </td>
                            <td style={{ padding: '3px 0', wordBreak: 'break-word' }}>{row.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            ) : (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('workbench.support.facts.unavailable')}
              </Text>
            )}
            <div
              style={{
                fontSize: 12,
                color: token.colorTextSecondary,
                borderTop: `1px solid ${token.colorBorderSecondary}`,
                paddingTop: 10,
              }}
            >
              {t('workbench.support.logs.notice')}{' '}
              <Button type="link" size="small" style={LINK_STYLE} onClick={() => void saveDiagnosticsBundle()}>
                {t('workbench.support.logs.saveBundle')}
              </Button>
            </div>
          </>
        ) : null}
        {factsNote ? (
          <Text type={link.overBudget ? 'danger' : 'secondary'} style={{ fontSize: 12 }}>
            {factsNote}
          </Text>
        ) : null}
      </div>
    </Modal>
  );
};

export default ReportIssueDialog;
