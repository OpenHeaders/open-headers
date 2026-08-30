/**
 * ScriptChainTag — the meta-strip attribution tag for the script chain
 * a run actually executed, rendered from the snapshot's per-level
 * `scripts.*.chain` record (never a live tree read): "Scripts · 3" for
 * the levels that ran across both phases, warning tone when any level
 * failed, the popover listing each phase's levels in execution order
 * — Collection ‘Payments’ · Folder ‘Tokens’ · Request — with their
 * duration and verdict, the failing level's error beneath it. A run
 * whose snapshot records no chain (scriptless, or minted before the
 * record existed) renders nothing.
 */

import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import type { ExecutedRequestSnapshot, ExecutedScriptChainStep } from '@openheaders/core/types';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { InfoPopover, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { Tag, Typography, theme } from 'antd';
import type React from 'react';
import { inheritSourceLabel } from '../inherited-auth';

const { Text } = Typography;

type Scripts = NonNullable<ExecutedRequestSnapshot['scripts']>;

/** The two phases' recorded chains, in execution order; empty when the run recorded none. */
export function scriptChainOf(scripts: Scripts | null | undefined): {
  pre: ExecutedScriptChainStep[];
  post: ExecutedScriptChainStep[];
} {
  return { pre: scripts?.preRequest?.chain ?? [], post: scripts?.postResponse?.chain ?? [] };
}

/** Whether the run earns the tag — at least one level was recorded. */
export function scriptChainHasBadge(scripts: Scripts | null | undefined): boolean {
  const { pre, post } = scriptChainOf(scripts);
  return pre.length + post.length > 0;
}

function stepLabel(step: ExecutedScriptChainStep, t: Translate): string {
  return step.level === 'request'
    ? t('workbench.editors.request.response.meta.scriptsLevelRequest')
    : inheritSourceLabel(t, { kind: step.level, name: step.name });
}

const ChainPhase: React.FC<{ heading: string; steps: readonly ExecutedScriptChainStep[] }> = ({
  heading,
  steps,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  if (steps.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Text strong style={{ fontSize: 11 }}>
        {heading}
      </Text>
      {steps.map((step, i) => (
        <div
          key={`${step.level}:${step.uid}:${i}`}
          data-testid="oh-response-script-step"
          style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12 }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            {step.succeeded ? (
              <CheckOutlined style={{ color: token.colorSuccess, fontSize: 11 }} />
            ) : (
              <CloseOutlined style={{ color: token.colorError, fontSize: 11 }} />
            )}
            <span style={{ flex: 1, minWidth: 0 }}>{stepLabel(step, t)}</span>
            <span style={{ color: token.colorTextSecondary, fontVariantNumeric: 'tabular-nums' }}>
              {t('workbench.editors.request.response.meta.scriptsDuration', { ms: Math.round(step.durationMs) })}
            </span>
          </div>
          {step.error !== undefined && (
            <Text type="danger" style={{ fontSize: 11, paddingLeft: 19, wordBreak: 'break-word' }}>
              {step.error.message}
            </Text>
          )}
        </div>
      ))}
    </div>
  );
};

function contentOf(scripts: Scripts, failed: boolean, t: Translate): InfoPopoverContent {
  const { pre, post } = scriptChainOf(scripts);
  return {
    title: t('workbench.editors.request.response.meta.scriptsTitle'),
    kicker: t('workbench.editors.request.response.meta.kicker'),
    summary: failed
      ? t('workbench.editors.request.response.meta.scriptsSummaryFailed')
      : t('workbench.editors.request.response.meta.scriptsSummary'),
    description: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 240, maxWidth: 380 }}>
        <ChainPhase heading={t('workbench.editors.request.response.console.preRequest')} steps={pre} />
        <ChainPhase heading={t('workbench.editors.request.response.console.postResponse')} steps={post} />
      </div>
    ),
  };
}

const ScriptChainTag: React.FC<{ scripts: Scripts | null | undefined }> = ({ scripts }) => {
  const t = useT();
  if (!scripts || !scriptChainHasBadge(scripts)) return null;
  const { pre, post } = scriptChainOf(scripts);
  const failed = [...pre, ...post].some((step) => !step.succeeded);
  return (
    <InfoPopover content={contentOf(scripts, failed, t)} trigger="hover">
      <Tag
        color={failed ? 'warning' : 'default'}
        data-testid="oh-response-scripts"
        style={{ marginInlineEnd: 0, cursor: 'help' }}
      >
        {t('workbench.editors.request.response.meta.scriptsTag', { count: pre.length + post.length })}
      </Tag>
    </InfoPopover>
  );
};

export default ScriptChainTag;
