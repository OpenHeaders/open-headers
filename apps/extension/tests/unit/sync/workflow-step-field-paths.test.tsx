// @vitest-environment jsdom
/**
 * Per-step `data-field-path` propagation in WorkflowStepEditor.
 *
 * Awareness publishing inside `LiveWorkflowEditor` rides
 * `data-field-path` ancestor walks (see `shared/awareness/live-paths.ts`). The
 * step editor wraps four leaves declared by `LIVE_WORKFLOW_FIELD.step`:
 * `id`, `requestUid`, `gate`, `captures`. These tests verify the
 * attribute is present at the right leaves and that `readFieldPath`
 * resolves a focusable descendant to the matching path.
 */

import type { DraftStep } from '@openheaders/core/live';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFieldPath } from '@/shared/awareness/field-path';
import { LIVE_WORKFLOW_FIELD } from '@/shared/awareness/live-paths';
import WorkflowStepEditor from '@/workbench/components/live/WorkflowStepEditor';

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

afterEach(() => {
  cleanup();
});

function mkStep(overrides: Partial<DraftStep> = {}): DraftStep {
  return { id: 'authenticate', requestUid: 'req-auth', captures: [], ...overrides };
}

function renderStep(index: number, step: DraftStep) {
  const { container } = render(
    <WorkflowStepEditor
      step={step}
      index={index}
      totalSteps={index + 1}
      availableRequests={[
        { uid: 'req-auth', name: 'auth', method: 'POST', collectionName: 'openheaders.io', folderTrail: ['oauth'] },
      ]}
      onChange={vi.fn()}
    />,
  );
  return container;
}

describe('WorkflowStepEditor — per-step data-field-path', () => {
  it('wraps the step id Input with steps.{index}.id', () => {
    const container = renderStep(0, mkStep());
    const idInput = container.querySelector<HTMLInputElement>('input[value="authenticate"]');
    expect(idInput).not.toBeNull();
    expect(readFieldPath(idInput)).toBe(LIVE_WORKFLOW_FIELD.step(0, 'id'));
    expect(readFieldPath(idInput)).toBe('steps.0.id');
  });

  it('wraps the request Select with steps.{index}.requestUid', () => {
    const container = renderStep(2, mkStep());
    const wrapper = container.querySelector<HTMLElement>(
      `[data-field-path="${LIVE_WORKFLOW_FIELD.step(2, 'requestUid')}"]`,
    );
    expect(wrapper).not.toBeNull();
    // The Select renders an internal focusable element inside the
    // wrapping span — focus events bubble up to it.
    const focusable = wrapper?.querySelector<HTMLElement>('.ant-select');
    expect(focusable).not.toBeNull();
    expect(readFieldPath(focusable ?? null)).toBe('steps.2.requestUid');
  });

  it('wraps the captures section with steps.{index}.captures', () => {
    const container = renderStep(3, mkStep());
    const capturesWrapper = container.querySelector<HTMLElement>(
      `[data-field-path="${LIVE_WORKFLOW_FIELD.step(3, 'captures')}"]`,
    );
    expect(capturesWrapper).not.toBeNull();
    // The "+ Capture" button lives inside this wrapper — its focus
    // resolves to the captures path.
    const addBtn = capturesWrapper?.querySelector('button');
    expect(addBtn).not.toBeNull();
    expect(readFieldPath(addBtn ?? null)).toBe('steps.3.captures');
  });

  it('per-step paths do not collide across indices', () => {
    expect(LIVE_WORKFLOW_FIELD.step(0, 'requestUid')).not.toBe(LIVE_WORKFLOW_FIELD.step(1, 'requestUid'));
    expect(LIVE_WORKFLOW_FIELD.step(4, 'gate')).toBe('steps.4.gate');
  });
});
