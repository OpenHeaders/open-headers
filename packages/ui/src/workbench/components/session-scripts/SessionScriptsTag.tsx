/**
 * SessionScriptsTag — a session pane's meta-strip attribution for the
 * scripts that ran (the HTTP `ScriptChainTag` generalized to hook
 * groups): "Scripts · N" for the hook runs so far, warning tone when
 * any run failed, the popover listing each hook that ran with its
 * runs · failed · dropped · duration and the levels that contributed.
 * Kind-generic — the family's vocabulary names the hooks and the
 * pane's catalog keys; live it reads the feed's marks, settled the
 * snapshot's record (both through the digest).
 */

import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import type { SessionScriptKind } from '@openheaders/core/scripts';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { InfoPopover, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { Tag, Typography, theme } from 'antd';
import type React from 'react';
import { inheritSourceLabel } from '../request-editor/inherited-auth';
import type { SessionHookDigest, SessionScriptsDigest } from './session-scripts-digest';
import type { SessionScriptsVocabulary } from './session-scripts-vocabulary';

const { Text } = Typography;

interface HookRowProps<K extends SessionScriptKind> {
  digest: SessionHookDigest<K>;
  vocabulary: SessionScriptsVocabulary<K>;
}

function runsText<K extends SessionScriptKind>(count: number, keys: SessionScriptsVocabulary<K>['keys'], t: Translate) {
  return count === 1 ? t(keys.runsOne) : t(keys.runs, { count });
}

function HookRow<K extends SessionScriptKind>({ digest, vocabulary }: HookRowProps<K>): React.ReactElement {
  const { token } = theme.useToken();
  const t = useT();
  const { keys } = vocabulary;
  const facts = [runsText(digest.runs, keys, t)];
  if (digest.failed > 0) facts.push(t(keys.failed, { count: digest.failed }));
  if (digest.dropped > 0) facts.push(t(keys.dropped, { count: digest.dropped }));
  facts.push(t('workbench.editors.request.response.meta.scriptsDuration', { ms: Math.round(digest.durationMs) }));
  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
      data-testid={`${vocabulary.testIdPrefix}-session-scripts-hook`}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        {digest.failed === 0 ? (
          <CheckOutlined style={{ color: token.colorSuccess, fontSize: 11 }} />
        ) : (
          <CloseOutlined style={{ color: token.colorError, fontSize: 11 }} />
        )}
        <Text strong style={{ fontSize: 12, flex: 1, minWidth: 0 }}>
          {t(vocabulary.hookLabelKey[digest.hook])}
        </Text>
        <span style={{ color: token.colorTextSecondary, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
          {facts.join(' · ')}
        </span>
      </div>
      {digest.levels.map((level) => (
        <div
          key={`${level.level}:${level.uid}`}
          style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 12, paddingLeft: 19 }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            {level.level === 'request'
              ? t('workbench.editors.request.response.meta.scriptsLevelRequest')
              : inheritSourceLabel(t, { kind: level.level, name: level.name })}
          </span>
          <span style={{ color: token.colorTextSecondary, fontVariantNumeric: 'tabular-nums' }}>
            {level.failed > 0
              ? t(keys.failed, { count: level.failed })
              : t('workbench.editors.request.response.meta.scriptsDuration', { ms: Math.round(level.durationMs) })}
          </span>
        </div>
      ))}
      {digest.lastError !== undefined && (
        <Text type="danger" style={{ fontSize: 11, paddingLeft: 19, wordBreak: 'break-word' }}>
          {digest.lastError}
        </Text>
      )}
    </div>
  );
}

function contentOf<K extends SessionScriptKind>(
  digest: SessionScriptsDigest<K>,
  vocabulary: SessionScriptsVocabulary<K>,
  t: Translate,
): InfoPopoverContent {
  const { keys } = vocabulary;
  return {
    title: t(keys.tagTitle),
    kicker: t('workbench.editors.request.response.meta.kicker'),
    summary: digest.failed > 0 ? t(keys.tagSummaryFailed) : t(keys.tagSummary),
    description: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 260, maxWidth: 400 }}>
        {digest.hooks.map((hook) => (
          <HookRow key={hook.hook} digest={hook} vocabulary={vocabulary} />
        ))}
      </div>
    ),
  };
}

interface SessionScriptsTagProps<K extends SessionScriptKind> {
  digest: SessionScriptsDigest<K>;
  vocabulary: SessionScriptsVocabulary<K>;
}

function SessionScriptsTag<K extends SessionScriptKind>({
  digest,
  vocabulary,
}: SessionScriptsTagProps<K>): React.ReactElement | null {
  const t = useT();
  if (digest.runs === 0) return null;
  return (
    <InfoPopover content={contentOf(digest, vocabulary, t)} trigger="hover">
      <Tag
        color={digest.failed > 0 ? 'warning' : 'default'}
        data-testid={`${vocabulary.testIdPrefix}-session-scripts-tag`}
        style={{ marginInlineEnd: 0, cursor: 'help' }}
      >
        {t(vocabulary.keys.tag, { count: digest.runs })}
      </Tag>
    </InfoPopover>
  );
}

export default SessionScriptsTag;
