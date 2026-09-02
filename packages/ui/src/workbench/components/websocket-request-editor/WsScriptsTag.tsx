/**
 * WsScriptsTag — the session pane's meta-strip attribution for the
 * scripts that ran (the HTTP `ScriptChainTag` generalized to hook
 * groups): "Scripts · N" for the hook runs so far, warning tone when
 * any run failed, the popover listing each hook that ran with its
 * runs · failed · duration and the levels that contributed. Live it
 * reads the feed's marks; settled, the snapshot's record.
 */

import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { InfoPopover, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { Tag, Typography, theme } from 'antd';
import type React from 'react';
import { inheritSourceLabel } from '../request-editor/inherited-auth';
import { WS_HOOK_LABEL_KEY, type WsHookDigest, type WsScriptsDigest } from './ws-scripts';

const { Text } = Typography;

function runsText(count: number, t: Translate): string {
  return count === 1
    ? t('workbench.editors.websocket.session.scripts.runsOne')
    : t('workbench.editors.websocket.session.scripts.runs', { count });
}

const HookRow: React.FC<{ digest: WsHookDigest }> = ({ digest }) => {
  const { token } = theme.useToken();
  const t = useT();
  const facts = [runsText(digest.runs, t)];
  if (digest.failed > 0) facts.push(t('workbench.editors.websocket.session.scripts.failed', { count: digest.failed }));
  if (digest.dropped > 0) facts.push(t('workbench.editors.websocket.session.scripts.dropped', { count: digest.dropped }));
  facts.push(t('workbench.editors.request.response.meta.scriptsDuration', { ms: Math.round(digest.durationMs) }));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} data-testid="ws-session-scripts-hook">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        {digest.failed === 0 ? (
          <CheckOutlined style={{ color: token.colorSuccess, fontSize: 11 }} />
        ) : (
          <CloseOutlined style={{ color: token.colorError, fontSize: 11 }} />
        )}
        <Text strong style={{ fontSize: 12, flex: 1, minWidth: 0 }}>
          {t(WS_HOOK_LABEL_KEY[digest.hook])}
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
              ? t('workbench.editors.websocket.session.scripts.failed', { count: level.failed })
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
};

function contentOf(digest: WsScriptsDigest, t: Translate): InfoPopoverContent {
  return {
    title: t('workbench.editors.websocket.session.scripts.tagTitle'),
    kicker: t('workbench.editors.request.response.meta.kicker'),
    summary:
      digest.failed > 0
        ? t('workbench.editors.websocket.session.scripts.tagSummaryFailed')
        : t('workbench.editors.websocket.session.scripts.tagSummary'),
    description: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 260, maxWidth: 400 }}>
        {digest.hooks.map((hook) => (
          <HookRow key={hook.hook} digest={hook} />
        ))}
      </div>
    ),
  };
}

const WsScriptsTag: React.FC<{ digest: WsScriptsDigest }> = ({ digest }) => {
  const t = useT();
  if (digest.runs === 0) return null;
  return (
    <InfoPopover content={contentOf(digest, t)} trigger="hover">
      <Tag
        color={digest.failed > 0 ? 'warning' : 'default'}
        data-testid="ws-session-scripts-tag"
        style={{ marginInlineEnd: 0, cursor: 'help' }}
      >
        {t('workbench.editors.websocket.session.scripts.tag', { count: digest.runs })}
      </Tag>
    </InfoPopover>
  );
};

export default WsScriptsTag;
