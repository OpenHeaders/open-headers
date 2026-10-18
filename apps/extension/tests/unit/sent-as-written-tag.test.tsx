// @vitest-environment jsdom
/**
 * The strips' "Sent as written" tag — rendered off a snapshot's
 * `sentAsWritten` (the executor's attribution: every reference no
 * scope answered, with the resolver's fix), its popover listing each
 * reference against its hint. Every reference resolved, no badge.
 */

import type { SentAsWrittenReference } from '@openheaders/core/types';
import GrpcMetaStrip from '@openheaders/ui/workbench/components/grpc-request-editor/GrpcMetaStrip';
import SentAsWrittenTag, {
  sentAsWrittenHasBadge,
} from '@openheaders/ui/workbench/components/request-editor/response/SentAsWrittenTag';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

beforeAll(() => {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  const scope = globalThis as unknown as { ResizeObserver?: typeof ResizeObserver };
  if (typeof scope.ResizeObserver === 'undefined') {
    scope.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  }
});

afterEach(cleanup);

const references: SentAsWrittenReference[] = [
  {
    reference: 'waat',
    hint: 'Not found in vault, environment, collection, or workspace. Define it in one of those scopes.',
  },
  {
    reference: 'env.HOST',
    hint: 'No active environment is selected. Select one in Environments, or set a default environment.',
  },
];

describe('SentAsWrittenTag', () => {
  it('stays quiet when every reference resolved', () => {
    expect(sentAsWrittenHasBadge(undefined)).toBe(false);
    expect(sentAsWrittenHasBadge([])).toBe(false);
    render(<SentAsWrittenTag references={[]} />);
    expect(screen.queryByTestId('oh-response-sent-as-written')).toBeNull();
  });

  it('counts the references in the warning tone and lists each against the resolver’s fix', async () => {
    render(<SentAsWrittenTag references={references} />);
    const tag = screen.getByTestId('oh-response-sent-as-written');
    expect(tag.textContent).toBe('Sent as written · 2');
    expect(tag.className).toContain('ant-tag-warning');
    fireEvent.mouseEnter(tag);
    expect(await screen.findByText('Sent as written')).toBeTruthy();
    const labels = Array.from(document.querySelectorAll('code.oh-info-popover-section-item-label')).map(
      (el) => el.textContent,
    );
    expect(labels).toEqual(['{{waat}}', '{{env.HOST}}']);
    expect(screen.getByText(references[0].hint)).toBeTruthy();
    expect(screen.getByText(references[1].hint)).toBeTruthy();
  });

  it('rides the gRPC meta strip beside the other attribution tags', () => {
    render(<GrpcMetaStrip status={0} sentAsWritten={references} />);
    expect(screen.getByTestId('oh-response-sent-as-written').textContent).toBe('Sent as written · 2');
    cleanup();
    render(<GrpcMetaStrip status={0} />);
    expect(screen.queryByTestId('oh-response-sent-as-written')).toBeNull();
  });
});
