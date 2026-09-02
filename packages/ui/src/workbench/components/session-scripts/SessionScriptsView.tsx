/**
 * SessionScriptsView — a session pane's Scripts view: what the
 * session's hooks logged and asserted, per event, live while the
 * session is open and from the settled snapshot after. Two sections
 * over the `script` marks (the HTTP response panel's Console and Tests
 * views folded into one, because a session's assertions and logs
 * arrive interleaved per event): Console lists each mark that logged
 * something under its hook and event heading; Tests lists every
 * assertion the hooks registered, newest last, with the hook it came
 * from. The marks stop at the cap — the digest's note says so.
 * Kind-generic — the family's vocabulary names the hooks and the
 * pane's catalog keys.
 */

import type { SessionScriptKind, TestAssertion } from '@openheaders/core/scripts';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Tag, Typography } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import ScriptLogList from '../request-editor/response/ScriptLogList';
import type { SessionScriptMarkItem } from './session-scripts-digest';
import type { SessionScriptsVocabulary } from './session-scripts-vocabulary';

const { Text } = Typography;

interface SessionScriptsViewProps<K extends SessionScriptKind> {
  marks: readonly SessionScriptMarkItem<K>[];
  /** The per-event marks stopped at the cap — the tallies kept going. */
  marksCapped?: boolean;
  vocabulary: SessionScriptsVocabulary<K>;
}

/** Session timestamps are wall-clock local times — HH:MM:SS.mmm. */
function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number, width = 2) => String(n).padStart(width, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

function SessionScriptsView<K extends SessionScriptKind>({
  marks,
  marksCapped = false,
  vocabulary,
}: SessionScriptsViewProps<K>): React.ReactElement {
  const t = useT();
  const { keys, testIdPrefix } = vocabulary;
  const heading = (mark: SessionScriptMarkItem<K>): string => {
    const hook = t(vocabulary.hookLabelKey[mark.hook]);
    const event =
      mark.attempt !== undefined
        ? t(keys.attempt, { attempt: mark.attempt + 1 })
        : mark.hook === vocabulary.closeHook
          ? null
          : t(keys.atMessage, { index: mark.atIndex });
    return event === null ? hook : `${hook} · ${event}`;
  };

  const logged = useMemo(() => marks.filter((m) => m.consoleLog !== undefined && m.consoleLog.length > 0), [marks]);
  const tests = useMemo(
    () =>
      marks.flatMap((mark) =>
        (mark.assertions ?? []).map(
          (assertion, i): { key: string; mark: SessionScriptMarkItem<K>; assertion: TestAssertion } => ({
            key: `${mark.hook}:${mark.atIndex}:${i}`,
            mark,
            assertion,
          }),
        ),
      ),
    [marks],
  );

  if (marks.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t(keys.empty)}
        </Text>
      </div>
    );
  }

  return (
    <div
      style={{ flex: 1, overflow: 'auto', overscrollBehavior: 'none', minHeight: 0, paddingTop: 4 }}
      data-testid={`${testIdPrefix}-session-scripts-view`}
    >
      {marksCapped && (
        <Text type="warning" style={{ fontSize: 11, display: 'block', marginBottom: 8 }}>
          {t(keys.marksCapped, { count: marks.length })}
        </Text>
      )}
      <Text strong style={{ fontSize: 11 }}>
        {t(keys.console)}
      </Text>
      {logged.length === 0 ? (
        <div style={{ padding: '4px 0 8px' }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {t(keys.consoleEmpty)}
          </Text>
        </div>
      ) : (
        logged.map((mark) => (
          <div key={`${mark.hook}:${mark.atIndex}`} data-testid={`${testIdPrefix}-script-console-block`}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '4px 0 0' }}>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {heading(mark)}
              </Text>
              {mark.atMs !== undefined && (
                <Text type="secondary" style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
                  {formatTime(mark.atMs)}
                </Text>
              )}
            </div>
            <ScriptLogList entries={mark.consoleLog ?? []} />
          </div>
        ))
      )}
      <Text strong style={{ fontSize: 11 }}>
        {t(keys.tests)}
      </Text>
      {tests.length === 0 ? (
        <div style={{ padding: '4px 0 8px' }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {t(keys.testsEmpty)}
          </Text>
        </div>
      ) : (
        tests.map(({ key, mark, assertion }) => (
          <div
            key={key}
            data-testid={`${testIdPrefix}-script-test-row`}
            style={{ display: 'flex', gap: 8, fontSize: 12, padding: '4px 0', alignItems: 'flex-start' }}
          >
            <Tag color={assertion.passed ? 'success' : 'error'} style={{ marginInlineEnd: 0 }}>
              {assertion.passed
                ? t('workbench.editors.request.response.assertions.pass')
                : t('workbench.editors.request.response.assertions.fail')}
            </Tag>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Text>{assertion.name}</Text>
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {heading(mark)}
                </Text>
              </div>
              {!assertion.passed && assertion.message && (
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {assertion.message}
                  </Text>
                </div>
              )}
            </div>
            {typeof assertion.durationMs === 'number' && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                {assertion.durationMs} ms
              </Text>
            )}
          </div>
        ))
      )}
    </div>
  );
}

export default SessionScriptsView;
