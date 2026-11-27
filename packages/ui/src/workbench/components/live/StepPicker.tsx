/**
 * StepPicker — what a workflow's "add a step" doors open (the workflow
 * runs plan, Decisions log, S31): a search field over the step kinds,
 * then the saved requests with their collection path. A kind taken is a
 * step with nothing picked yet; a request taken is a call on it — a
 * listen, for a request that opens a session. Enter takes the first row.
 *
 * `StepPickerPopover` hangs it on a door: the button that opens it, or a
 * point of the graph.
 */

import { SearchOutlined } from '@ant-design/icons';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Input, Popover, theme } from 'antd';
import type { TooltipPlacement } from 'antd/es/tooltip';
import type React from 'react';
import { useState } from 'react';
import { STEP_KIND_WORD } from './step-facts';
import {
  matchesStepSearch,
  offeredStepActions,
  offeredStepRequests,
  pickOfRequest,
  type StepPick,
  type StepPickerChoices,
} from './step-picker';
import { buildRequestPickerOptions } from './workflow-step-request-options';

interface StepPickerProps {
  /** The picker is open — it stays drawn a moment longer as it closes. */
  open: boolean;
  choices: StepPickerChoices;
  onPick: (pick: StepPick) => void;
  onClose: () => void;
}

interface PickerRow {
  testId: string;
  /** What a search reads, and the row's hover name. */
  text: string;
  label: React.ReactNode;
  pick: StepPick;
}

const HEAD: React.CSSProperties = {
  padding: '6px 4px 2px',
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
};

const StepPicker: React.FC<StepPickerProps> = ({ open, choices, onPick, onClose }) => {
  const { token } = theme.useToken();
  const t = useT();
  const [query, setQuery] = useState('');

  // A picker that is closing takes no row: a second Enter while it fades
  // adds nothing. The search field gives up focus before the step is
  // added — the draft's history reads an edit made from a focused field
  // as typing in it.
  const take = (pick: StepPick) => {
    if (!open) return;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    onPick(pick);
  };

  const kinds: PickerRow[] = offeredStepActions(choices.sessionAuthoring)
    .map((action): PickerRow => {
      const text = t(STEP_KIND_WORD[action]);
      return { testId: `wf-step-picker-kind-${action}`, text, label: text, pick: { kind: 'action', action } };
    })
    .filter((row) => matchesStepSearch(row.text, query));
  const offered = offeredStepRequests(choices);
  const requests: PickerRow[] = buildRequestPickerOptions(offered, token)
    .map(
      (option, index): PickerRow => ({
        testId: `wf-step-picker-request-${option.value}`,
        text: option.title,
        label: option.label,
        pick: pickOfRequest(offered[index]),
      }),
    )
    .filter((row) => matchesStepSearch(row.text, query));
  const first = kinds[0] ?? requests[0];

  const rowsOf = (rows: PickerRow[]) =>
    rows.map((row) => (
      <button
        key={row.testId}
        type="button"
        className="oh-wf-picker-row"
        data-testid={row.testId}
        data-first={row === first ? 'true' : undefined}
        title={row.text}
        onClick={() => take(row.pick)}
      >
        {row.label}
      </button>
    ));

  return (
    // The picker is drawn outside the graph but is its child: a key or a
    // press here is the picker's own, never a gesture of the graph.
    <div
      data-testid="wf-step-picker"
      style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') onClose();
      }}
    >
      <Input
        size="small"
        autoFocus
        allowClear
        data-testid="wf-step-picker-search"
        prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
        placeholder={t('workbench.editors.live.picker.search')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onPressEnter={() => {
          if (first !== undefined) take(first.pick);
        }}
      />
      {/* One height whatever matches: the picker keeps its place while a search narrows it. */}
      <div
        className="oh-persistent-scroll"
        style={{
          height: 240,
          overflowY: 'scroll',
          overscrollBehavior: 'none',
          display: 'flex',
          flexDirection: 'column',
          paddingRight: 2,
        }}
      >
        {first === undefined && (
          <div
            data-testid="wf-step-picker-empty"
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: token.colorTextTertiary,
            }}
          >
            {t('workbench.editors.live.picker.empty')}
          </div>
        )}
        {kinds.length > 0 && (
          <>
            <div style={{ ...HEAD, color: token.colorTextTertiary }}>{t('workbench.editors.live.picker.kinds')}</div>
            {rowsOf(kinds)}
          </>
        )}
        {requests.length > 0 && (
          <>
            <div style={{ ...HEAD, color: token.colorTextTertiary }}>
              {t('workbench.editors.live.picker.requests')}
            </div>
            {rowsOf(requests)}
          </>
        )}
      </div>
    </div>
  );
};

interface StepPickerPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placement: TooltipPlacement;
  choices: StepPickerChoices;
  onPick: (pick: StepPick) => void;
  /** The door: a press of it opens the picker, and the picker hangs on it. */
  children: React.ReactElement;
}

export const StepPickerPopover: React.FC<StepPickerPopoverProps> = ({
  open,
  onOpenChange,
  placement,
  choices,
  onPick,
  children,
}) => (
  <Popover
    content={<StepPicker open={open} choices={choices} onPick={onPick} onClose={() => onOpenChange(false)} />}
    trigger="click"
    placement={placement}
    open={open}
    onOpenChange={onOpenChange}
    destroyOnHidden
    styles={{ container: { padding: 8 } }}
  >
    {children}
  </Popover>
);

export default StepPicker;
