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

import { getHostBridge } from '@openheaders/core/bridge';
import {
  type DiagnosticsFacts,
  type IssueDraft,
  type IssueKind,
  issueLink,
  systemInformationRows,
} from '@openheaders/core/diagnostics';
import { BugOutlined, BulbOutlined } from '@ant-design/icons';
import { Button, Checkbox, Input, type InputRef, Modal, Segmented, Typography, theme } from 'antd';
import type { TextAreaRef } from 'antd/es/input/TextArea';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { getCurrentHost } from '../../shared/host-vocabulary';
import { openExternalLink } from '../../shared/open-external';
import { saveDiagnosticsBundle } from '../settings/diagnostics-bundle';
import { closeReportIssueDialog, useReportIssueDialog } from './store';

const { TextArea } = Input;
const { Text } = Typography;

const LINK_STYLE: React.CSSProperties = { padding: 0, height: 'auto', fontSize: 'inherit' };

const ReportIssueDialog: React.FC = () => {
  const t = useT();
  const { token } = theme.useToken();
  const { open, kind: openedKind, seed } = useReportIssueDialog();
  const [kind, setKind] = useState<IssueKind>(openedKind);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [facts, setFacts] = useState<DiagnosticsFacts | null>(null);
  const [includeFacts, setIncludeFacts] = useState(true);
  const [showFacts, setShowFacts] = useState(false);
  // Both inputs are required; a Preview on an empty one marks it and
  // moves the focus there instead of opening a half-filled issue.
  const [attempted, setAttempted] = useState(false);
  const titleRef = useRef<InputRef>(null);
  const descriptionRef = useRef<TextAreaRef>(null);

  // Each opening starts a fresh draft on the kind the entry chose (and
  // the seed it brought) and re-reads the facts — the window count or
  // the GPU table may have changed since the last report. No bridge at
  // all, or a host without the RPC (a served web tab): the form leaves
  // the version and platform to the person.
  useEffect(() => {
    if (!open) return;
    setKind(openedKind);
    setTitle(seed?.title ?? '');
    setDescription(seed?.description ?? '');
    setIncludeFacts(true);
    setShowFacts(false);
    setAttempted(false);
    setFacts(null);
    const bridge = getHostBridge();
    if (!bridge) return;
    let cancelled = false;
    bridge
      .call('diagnosticsFacts')
      .then((answer) => {
        if (!cancelled) setFacts(answer.facts);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, openedKind, seed]);

  const host = getCurrentHost();
  const draft = useMemo<IssueDraft>(() => ({ kind, title, description }), [kind, title, description]);
  const link = useMemo(
    () => issueLink(draft, host, includeFacts ? facts : null),
    [draft, host, includeFacts, facts],
  );
  const rows = useMemo(() => (facts ? systemInformationRows(facts) : []), [facts]);

  const titleMissing = title.trim() === '';
  const descriptionMissing = description.trim() === '';

  const preview = (): void => {
    if (titleMissing || descriptionMissing) {
      setAttempted(true);
      (titleMissing ? titleRef : descriptionRef).current?.focus();
      return;
    }
    openExternalLink(link.url);
    closeReportIssueDialog();
  };

  // The hint reads as two lines: what to write, then the Markdown note.
  const fieldLabel = (text: string, hint?: string, note?: string): React.ReactNode => (
    <div style={{ marginBottom: 4 }}>
      <div style={{ fontSize: 12, color: token.colorTextSecondary }}>
        <span style={{ color: token.colorError, marginRight: 4 }}>*</span>
        {text}
      </div>
      {hint ? <div style={{ fontSize: 12, color: token.colorTextTertiary }}>{hint}</div> : null}
      {note ? <div style={{ fontSize: 12, color: token.colorTextTertiary }}>{note}</div> : null}
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
      // The body takes a fixed share of the viewport (the What's New
      // cap) so the dialog never outgrows the window, the document never
      // grows a scrollbar of its own, and the kind switch does not resize
      // it — the feature kind has no facts block, the description takes
      // that room instead. The switch and the facts block stay put; only
      // the title and the description scroll between them.
      styles={{ body: { height: '65vh', display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 } }}
      title={kind === 'bug' ? t('workbench.support.title.bug') : t('workbench.support.title.feature')}
      footer={[
        <Button key="cancel" onClick={closeReportIssueDialog}>
          {t('shared.action.cancel')}
        </Button>,
        <Button key="preview" type="primary" disabled={link.overBudget} onClick={preview}>
          {t('workbench.support.preview')}
        </Button>,
      ]}
    >
      <Segmented<IssueKind>
        block
        value={kind}
        onChange={setKind}
        options={[
          { value: 'bug', label: t('workbench.support.kind.bug'), icon: <BugOutlined /> },
          { value: 'feature', label: t('workbench.support.kind.feature'), icon: <BulbOutlined /> },
        ]}
      />
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          // Room for the inputs' focus ring, which a scrolling box would clip.
          padding: 2,
        }}
      >
        <div>
          {fieldLabel(t('workbench.support.field.title'))}
          <Input
            ref={titleRef}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            status={attempted && titleMissing ? 'error' : undefined}
          />
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {kind === 'bug'
            ? fieldLabel(
                t('workbench.support.field.steps'),
                t('workbench.support.field.steps.hint'),
                t('workbench.support.field.markdownHint'),
              )
            : fieldLabel(
                t('workbench.support.field.description'),
                t('workbench.support.field.description.hint'),
                t('workbench.support.field.markdownHint'),
              )}
          <TextArea
            ref={descriptionRef}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            // Fills what the body leaves; a short window still gets a usable field and the box above scrolls.
            style={{ flex: 1, minHeight: 140, resize: 'none' }}
            status={attempted && descriptionMissing ? 'error' : undefined}
          />
        </div>
      </div>
      {kind === 'bug' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
          {factsNote ? (
            <Text type={link.overBudget ? 'danger' : 'secondary'} style={{ fontSize: 12 }}>
              {factsNote}
            </Text>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
};

export default ReportIssueDialog;
