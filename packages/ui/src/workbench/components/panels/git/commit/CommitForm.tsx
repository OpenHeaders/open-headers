/**
 * CommitForm — the Commit window's lower half: the
 * Amend row (checkbox + Commit Message History clock + the "N
 * modified" counter on the right), the Commit Message box, and the
 * button row — Commit, Commit and Push… (Amend Commit, Amend Commit
 * and Push… while Amend is on), and the gear popover with the
 * Git-real commit options (Sign-off; Run Git hooks). While Amend is
 * on a read-only "By <author>" row under the box names whose commit
 * is being rewritten (`--amend` keeps the author; the full identity
 * is its tooltip). Author override and the inspection checks are
 * deliberately absent (§11.5: git config is the identity authority).
 *
 * The history popup (the clock, ⌃M) previews as it goes: opening it
 * stashes the draft and lands the first entry in the box, selected;
 * hovering or arrowing replaces the box live; Enter or a click keeps
 * the entry, focuses the box with the whole message selected and the
 * caret at its start; Escape or a click away restores the stash.
 */

import { ClockCircleOutlined, SettingOutlined } from '@ant-design/icons';
import { Alert, Button, Checkbox, Input, Popover, theme, Tooltip } from 'antd';
import type { TextAreaRef } from 'antd/es/input/TextArea';
import type React from 'react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { ShortcutHintTitle } from '@openheaders/ui/components/ShortcutKbd';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { formatChord } from '@openheaders/ui/workbench/hooks/useWorkspaceShortcuts';
import {
  COMMIT_MESSAGE_HISTORY_CHORD,
  isCommitMessageHistoryChord,
  stepHistoryIndex,
} from './commit-message-history';
import { type ChangeCounter, type CommitAuthor, formatCommitAuthor } from './commit-model';

export interface CommitFormProps {
  draft: string;
  onDraftChange: (draft: string) => void;
  amend: boolean;
  onAmendChange: (amend: boolean) => void;
  /** The author of the commit Amend rewrites — shown under the box while Amend is on. */
  amendAuthor: CommitAuthor | null;
  counter: ChangeCounter;
  /** The bound repo's recent commit subjects, newest first. */
  history: string[];
  /** The popup is opening — refresh `history` from the log. */
  onHistoryOpen: () => void;
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
  /** Focus the box with the whole message selected, caret at the start (the Amend prefill's landing). */
  selectMessage: () => void;
}

interface PendingSelection {
  focus: boolean;
}

const CommitForm = forwardRef<CommitFormHandle, CommitFormProps>(function CommitForm(
  {
    draft,
  onDraftChange,
  amend,
  onAmendChange,
  amendAuthor,
  counter,
  history,
  onHistoryOpen,
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
  const [historyActive, setHistoryActive] = useState(-1);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [gearOpen, setGearOpen] = useState(false);
  const [gearTooltipSuppressed, setGearTooltipSuppressed] = useState(false);
  const [counterTipOpen, setCounterTipOpen] = useState(false);
  const counterRef = useRef<HTMLSpanElement>(null);
  const [selectTick, setSelectTick] = useState(0);
  const messageRef = useRef<TextAreaRef>(null);
  const preOpenDraft = useRef<string | null>(null);
  const pendingSelection = useRef<PendingSelection | null>(null);

  const requestSelection = useCallback((focus: boolean): void => {
    pendingSelection.current = { focus };
    setSelectTick((tick) => tick + 1);
  }, []);

  // The selection lands once the box has laid out the new value: the
  // autosize writes the box's height after the value commits, and a
  // height write drops an unfocused textarea's selection — so the
  // select waits for the next frame.
  useLayoutEffect(() => {
    const pending = pendingSelection.current;
    if (pending === null) return;
    pendingSelection.current = null;
    const frame = requestAnimationFrame(() => {
      const handle = messageRef.current;
      const textArea = handle?.resizableTextArea?.textArea;
      if (handle === null || textArea === undefined) return;
      if (pending.focus) handle.focus();
      textArea.setSelectionRange(0, textArea.value.length, 'backward');
    });
    return () => cancelAnimationFrame(frame);
  }, [draft, selectTick]);

  useImperativeHandle(
    handleRef,
    () => ({
      focusMessage: () => messageRef.current?.focus(),
      selectMessage: () => requestSelection(true),
    }),
    [requestSelection],
  );

  const activateHistory = useCallback(
    (index: number): void => {
      const message = history[index];
      if (message === undefined) return;
      setHistoryActive(index);
      onDraftChange(message);
      requestSelection(false);
    },
    [history, onDraftChange, requestSelection],
  );

  const openHistory = useCallback((): void => {
    if (historyOpen) return;
    preOpenDraft.current = draft;
    setTooltipOpen(false);
    setHistoryActive(-1);
    setHistoryOpen(true);
    onHistoryOpen();
  }, [draft, historyOpen, onHistoryOpen]);

  const cancelHistory = useCallback((): void => {
    if (!historyOpen) return;
    setHistoryOpen(false);
    if (preOpenDraft.current !== null) onDraftChange(preOpenDraft.current);
    preOpenDraft.current = null;
  }, [historyOpen, onDraftChange]);

  const pickHistory = useCallback(
    (index: number): void => {
      const message = history[index];
      if (message === undefined) return;
      setHistoryOpen(false);
      preOpenDraft.current = null;
      onDraftChange(message);
      requestSelection(true);
    },
    [history, onDraftChange, requestSelection],
  );

  // The first entry lands as soon as the list is there (the log
  // answers after the popup opens).
  useEffect(() => {
    if (historyOpen && historyActive < 0 && history.length > 0) activateHistory(0);
  }, [historyOpen, historyActive, history, activateHistory]);

  // The popup is keyboard-driven while open: arrows walk, Enter keeps,
  // Escape restores — captured on the window so focus may sit anywhere.
  useEffect(() => {
    if (!historyOpen) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        activateHistory(stepHistoryIndex(historyActive, history.length, event.key === 'ArrowDown' ? 1 : -1));
      } else if (event.key === 'Enter') {
        if (historyActive >= 0) pickHistory(historyActive);
        else cancelHistory();
      } else if (event.key === 'Escape') {
        cancelHistory();
      } else {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [historyOpen, historyActive, history.length, activateHistory, pickHistory, cancelHistory]);

  // The counter clips on one line in a narrow dock; its full text is
  // the tooltip, shown only while it is actually clipped (measured on
  // hover-in, like the tree rows' overlay).
  const counterClipped = (): boolean => {
    const element = counterRef.current;
    return element !== null && element.scrollWidth > element.clientWidth + 1;
  };

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
      {history.map((message, index) => (
        <button
          key={message}
          type="button"
          className="git-tool-row"
          onMouseEnter={() => activateHistory(index)}
          onClick={() => pickHistory(index)}
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
            ...(index === historyActive ? { background: token.controlItemBgActive } : {}),
          }}
          data-testid="commit-tool-history-row"
          data-active={index === historyActive ? 'true' : undefined}
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
        <span style={{ fontSize: 12 }}>{t('workbench.commitTool.options.signOff')}</span>
      </Checkbox>
      <Checkbox
        checked={runGitHooks}
        onChange={(event) => onRunGitHooksChange(event.target.checked)}
        data-testid="commit-tool-run-hooks"
      >
        <span style={{ fontSize: 12 }}>{t('workbench.commitTool.options.runGitHooks')}</span>
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
          <span style={{ fontSize: 12 }}>{t('workbench.commitTool.amend')}</span>
        </Checkbox>
        <Popover
          open={historyOpen}
          onOpenChange={(next) => (next ? openHistory() : cancelHistory())}
          trigger="click"
          placement="topLeft"
          content={historyContent}
        >
          <Tooltip
            placement="top"
            open={tooltipOpen && !historyOpen}
            onOpenChange={setTooltipOpen}
            styles={{ root: { maxWidth: 360 } }}
            title={
              <ShortcutHintTitle label={formatChord(COMMIT_MESSAGE_HISTORY_CHORD)}>
                {t('workbench.commitTool.historyTooltip')}
              </ShortcutHintTitle>
            }
          >
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
          <Tooltip
            placement="top"
            title={counterParts.join(', ')}
            open={counterTipOpen}
            onOpenChange={(next) => setCounterTipOpen(next && counterClipped())}
          >
            <span
              ref={counterRef}
              style={{
                flex: '0 1 auto',
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: 12,
                color: token.colorTextTertiary,
              }}
              data-testid="commit-tool-counter"
            >
              {counterParts.join(', ')}
            </span>
          </Tooltip>
        )}
      </div>
      <Input.TextArea
        ref={messageRef}
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={(event) => {
          if (isCommitMessageHistoryChord(event)) {
            event.preventDefault();
            openHistory();
          }
        }}
        placeholder={t('workbench.commitTool.messagePlaceholder')}
        autoSize={{ minRows: 3, maxRows: 8 }}
        style={{ fontFamily: token.fontFamilyCode, fontSize: 13 }}
        data-testid="commit-tool-message"
      />
      {amend && amendAuthor !== null && (
        <div style={{ fontSize: 12, color: token.colorTextTertiary }} data-testid="commit-tool-amend-author">
          {t('workbench.commitTool.amendBy')}{' '}
          <Tooltip placement="top" title={formatCommitAuthor(amendAuthor)}>
            <span style={{ color: token.colorLink }}>{amendAuthor.name}</span>
          </Tooltip>
        </div>
      )}
      {error !== null && (
        <Alert
          type="error"
          showIcon
          closable
          onClose={onDismissError}
          title={<span style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{error}</span>}
          data-testid="commit-tool-error"
        />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Button
          type={historyOpen ? 'default' : 'primary'}
          size="small"
          loading={committing}
          disabled={!canCommit}
          onClick={() => onCommit(false)}
          data-testid="commit-tool-commit"
        >
          {t(amend ? 'workbench.commitTool.amendCommit' : 'workbench.commitTool.commit')}
        </Button>
        <Button
          size="small"
          disabled={!canCommit || committing}
          onClick={() => onCommit(true)}
          data-testid="commit-tool-commit-push"
        >
          {t(amend ? 'workbench.commitTool.amendCommitAndPush' : 'workbench.commitTool.commitAndPush')}
        </Button>
        <span style={{ flex: 1 }} />
        {/* The popover opens beside the gear, never over the box. Its
            tooltip yields to it — hidden the instant the button is clicked
            and while the popover is open; re-arms on the next hover-in. */}
        <Popover trigger="click" placement="rightTop" content={gearContent} onOpenChange={setGearOpen}>
          <Tooltip
            placement="top"
            title={t('workbench.commitTool.optionsTooltip')}
            open={gearOpen || gearTooltipSuppressed ? false : undefined}
          >
            <Button
              type="text"
              size="small"
              icon={<SettingOutlined />}
              aria-label={t('workbench.commitTool.optionsTooltip')}
              data-testid="commit-tool-gear"
              onClick={() => setGearTooltipSuppressed(true)}
              onMouseEnter={() => setGearTooltipSuppressed(false)}
            />
          </Tooltip>
        </Popover>
      </div>
    </div>
  );
});

export default CommitForm;
