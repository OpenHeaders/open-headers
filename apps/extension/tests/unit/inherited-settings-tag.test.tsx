// @vitest-environment jsdom
/**
 * The strips' "Inherited settings" tag — rendered off a snapshot's
 * `inheritedSettings` (the executor's attribution, in the kind's key
 * order), its popover listing each knob's row label (the kind's own
 * spelling) against the level that supplied it. Nothing inherited,
 * no badge.
 */

import type { InheritedSettingSource } from '@openheaders/core/types';
import GrpcMetaStrip from '@openheaders/ui/workbench/components/grpc-request-editor/GrpcMetaStrip';
import InheritedSettingsTag, {
  inheritedSettingsHasBadge,
} from '@openheaders/ui/workbench/components/request-editor/response/InheritedSettingsTag';
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

const sources: InheritedSettingSource[] = [
  { key: 'sslVerification', level: 'collection', uid: 'col00001', name: 'Payments' },
  { key: 'timeoutMs', level: 'folder', uid: 'fld00001', name: 'Admin' },
];

describe('InheritedSettingsTag', () => {
  it('stays quiet when the run inherited nothing', () => {
    expect(inheritedSettingsHasBadge(undefined)).toBe(false);
    expect(inheritedSettingsHasBadge([])).toBe(false);
    render(<InheritedSettingsTag kind="http" sources={[]} />);
    expect(screen.queryByTestId('oh-response-inherited-settings')).toBeNull();
  });

  it('counts the inherited knobs and lists each against its level in the kind’s key order, the row label in the kind’s spelling', async () => {
    render(<InheritedSettingsTag kind="websocket" sources={sources} />);
    const tag = screen.getByTestId('oh-response-inherited-settings');
    expect(tag.textContent).toBe('Inherited settings · 2');
    fireEvent.mouseEnter(tag);
    expect(await screen.findByText('Inherited settings')).toBeTruthy();
    const labels = Array.from(document.querySelectorAll('code.oh-info-popover-section-item-label')).map(
      (el) => el.textContent,
    );
    expect(labels).toEqual(['SSL certificate verification', 'Connect timeout']);
    expect(screen.getByText('Collection ‘Payments’')).toBeTruthy();
    expect(screen.getByText('Folder ‘Admin’')).toBeTruthy();
  });

  it('words the timeout the HTTP way on an HTTP run', async () => {
    render(<InheritedSettingsTag kind="http" sources={sources} />);
    fireEvent.mouseEnter(screen.getByTestId('oh-response-inherited-settings'));
    expect(await screen.findByText('Request timeout')).toBeTruthy();
  });

  it('rides the gRPC meta strip beside the auth tag', () => {
    render(<GrpcMetaStrip status={0} inheritedSettings={sources} />);
    expect(screen.getByTestId('oh-response-inherited-settings').textContent).toBe('Inherited settings · 2');
    cleanup();
    render(<GrpcMetaStrip status={0} />);
    expect(screen.queryByTestId('oh-response-inherited-settings')).toBeNull();
  });
});
