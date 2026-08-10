/**
 * CommitForm — the Commit window's lower half (IDE reference): the
 * Amend row (checkbox + Commit Message History clock + the "N
 * modified" counter on the right), the Commit Message box, and the
 * button row — Commit, Commit and Push…, and the gear popover with the
 * Git-real commit options (Sign-off; Run Git hooks). Author override
 * and the IDE inspection checks are deliberately absent (§11.5: git
 * config is the identity authority).
 */

import { ClockCircleOutlined, SettingOutlined } from '@ant-design/icons';
import { Alert, Button, Checkbox, Input, Popover, theme, Tooltip } from 'antd';
import type { TextAreaRef } from 'antd/es/input/TextArea';
import type React from 'react';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import type { ChangeCounter } from './commit-model';

export interface CommitFormProps {
  draft: string;
  onDraftChange: (draft: string) => void;
  amend: boolean;
  onAmendChange: (amend: boolean) => void;
  counter: ChangeCounter;
  history: string[];
  onPickHistory: (message: string) => void;
  signOff: boolean;
  onSignOffChange: (signOff: boolean) => void;
  runGitHooks: boolean;
  onRunGitHooksChange: (runGitHooks: boolean) => void;
  committing: boolean;
  canCommit: boolean;
  onCommit: (andPush: boolean) => void;
  error: string | null;
  onDismissError: () => void;
}

export interface CommitFormHandle {
  /** The Commit File… gesture's landing — focus the message box. */
  focusMessage: () => void;
}

const CommitForm = forwardRef<CommitFormHandle, CommitFormProps>(function CommitForm(
  {
    draft,
  onDraftChange,
  amend,
  onAmendChange,
  counter,
  history,
  onPickHistory,
  signOff,
  onSignOffChange,
  runGitHooks,
  onRunGitHooksChange,
    committing,
    canCommit,
    onCommit,
    error,
    onDismissError,
  },
  handleRef,
) {
  const t = useT();
  const { token } = theme.useToken();
  const [historyOpen, setHistoryOpen] = useState(false);
  const messageRef = useRef<TextAreaRef>(null);

  useImperativeHandle(handleRef, () => ({ focusMessage: () => messageRef.current?.focus() }), []);

  const counterParts: string[] = [];
  if (counter.modified > 0) counterParts.push(t('workbench.commitTool.counter.modified', { count: counter.modified }));
  if (counter.added > 0) counterParts.push(t('workbench.commitTool.counter.added', { count: counter.added }));
  if (counter.deleted > 0) counterParts.push(t('workbench.commitTool.counter.deleted', { count: counter.deleted }));
  if (counter.unversioned > 0) {
    counterParts.push(t('workbench.commitTool.counter.unversioned', { count: counter.unversioned }));
  }

  const historyContent = (
    <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 420, maxHeight: 280, overflowY: 'auto' }}>
      {history.length === 0 && (
        <span style={{ fontSize: 12, color: token.colorTextTertiary, padding: '4px 8px' }}>
          {t('workbench.commitTool.historyEmpty')}
        </span>
      )}
      {history.map((message) => (
        <button
          key={message}
          type="button"
          className="git-tool-row"
          onClick={() => {
            onPickHistory(message);
            setHistoryOpen(false);
          }}
          style={{
            border: 'none',
            textAlign: 'left',
            padding: '3px 8px',
            fontSize: 12,
            fontFamily: token.fontFamilyCode,
            color: token.colorText,
            cursor: 'pointer',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          data-testid="commit-tool-history-row"
        >
          {message.split('\n')[0]}
        </button>
      ))}
    </div>
  );

  const gearContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 200 }} data-testid="commit-tool-options">
      <span style={{ fontSize: 11, fontWeight: 600, color: token.colorTextTertiary }}>
        {t('workbench.commitTool.options.gitSection')}
      </span>
      <Checkbox
        checked={signOff}
        onChange={(event) => onSignOffChange(event.target.checked)}
        data-testid="commit-tool-sign-off"
      >
        <span style={{ fontSize: 13 }}>{t('workbench.commitTool.options.signOff')}</span>
      </Checkbox>
      <Checkbox
        checked={runGitHooks}
        onChange={(event) => onRunGitHooksChange(event.target.checked)}
        data-testid="commit-tool-run-hooks"
      >
        <span style={{ fontSize: 13 }}>{t('workbench.commitTool.options.runGitHooks')}</span>
      </Checkbox>
    </div>
  );

  return (
    <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 12px 10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Checkbox
          checked={amend}
          onChange={(event) => onAmendChange(event.target.checked)}
          data-testid="commit-tool-amend"
        >
          <span style={{ fontSize: 13 }}>{t('workbench.commitTool.amend')}</span>
        </Checkbox>
        <Popover
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          trigger="click"
          placement="topLeft"
          content={historyContent}
        >
          <Tooltip placement="top" title={t('workbench.commitTool.historyTooltip')}>
            <Button
              type="text"
              size="small"
              icon={<ClockCircleOutlined />}
              aria-label={t('workbench.commitTool.historyTooltip')}
              data-testid="commit-tool-history"
            />
          </Tooltip>
        </Popover>
        <span style={{ flex: 1 }} />
        {counterParts.length > 0 && (
          <span style={{ fontSize: 13, color: token.colorTextTertiary }} data-testid="commit-tool-counter">
            {counterParts.join(', ')}
          </span>
        )}
      </div>
      <Input.TextArea
        ref={messageRef}
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        placeholder={t('workbench.commitTool.messagePlaceholder')}
        autoSize={{ minRows: 3, maxRows: 8 }}
        style={{ fontFamily: token.fontFamilyCode, fontSize: 13 }}
        data-testid="commit-tool-message"
      />
      {error !== null && (
        <Alert
          type="error"
          showIcon
          closable
          onClose={onDismissError}
          message={<span style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{error}</span>}
          data-testid="commit-tool-error"
        />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Button
          type="primary"
          size="small"
          loading={committing}
          disabled={!canCommit}
          onClick={() => onCommit(false)}
          data-testid="commit-tool-commit"
        >
          {t('workbench.commitTool.commit')}
        </Button>
        <Button
          size="small"
          disabled={!canCommit || committing}
          onClick={() => onCommit(true)}
          data-testid="commit-tool-commit-push"
        >
          {t('workbench.commitTool.commitAndPush')}
        </Button>
        <span style={{ flex: 1 }} />
        <Popover trigger="click" placement="topRight" content={gearContent}>
          <Tooltip placement="top" title={t('workbench.commitTool.optionsTooltip')}>
            <Button
              type="text"
              size="small"
              icon={<SettingOutlined />}
              aria-label={t('workbench.commitTool.optionsTooltip')}
              data-testid="commit-tool-gear"
            />
          </Tooltip>
        </Popover>
      </div>
    </div>
  );
});

export default CommitForm;
