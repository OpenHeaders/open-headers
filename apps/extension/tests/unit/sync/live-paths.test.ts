// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readFieldPath } from '@/shared/awareness/field-path';
import { LIVE_VARIABLE_FIELD, LIVE_WORKFLOW_FIELD } from '@/shared/awareness/live-paths';

describe('LIVE_VARIABLE_FIELD constants', () => {
  it('exposes canonical schema-aligned paths', () => {
    expect(LIVE_VARIABLE_FIELD.name).toBe('name');
    expect(LIVE_VARIABLE_FIELD.description).toBe('description');
    expect(LIVE_VARIABLE_FIELD.enabled).toBe('enabled');
    expect(LIVE_VARIABLE_FIELD.requireFreshOnRuleBuild).toBe('requireFreshOnRuleBuild');
    expect(LIVE_VARIABLE_FIELD.workflowUid).toBe('workflowUid');
    expect(LIVE_VARIABLE_FIELD.stepId).toBe('stepId');
    expect(LIVE_VARIABLE_FIELD.captureName).toBe('captureName');
    expect(LIVE_VARIABLE_FIELD.manualOverrideValue).toBe('manualOverride.value');
    expect(LIVE_VARIABLE_FIELD.manualOverrideUntil).toBe('manualOverride.until');
  });
});

describe('LIVE_WORKFLOW_FIELD constants', () => {
  it('exposes canonical schema-aligned paths', () => {
    expect(LIVE_WORKFLOW_FIELD.name).toBe('name');
    expect(LIVE_WORKFLOW_FIELD.description).toBe('description');
    expect(LIVE_WORKFLOW_FIELD.enabled).toBe('enabled');
    expect(LIVE_WORKFLOW_FIELD.refresh).toBe('refresh');
    expect(LIVE_WORKFLOW_FIELD.steps).toBe('steps');
  });

  it('builds indexed step paths', () => {
    expect(LIVE_WORKFLOW_FIELD.step(0, 'id')).toBe('steps.0.id');
    expect(LIVE_WORKFLOW_FIELD.step(2, 'requestUid')).toBe('steps.2.requestUid');
    expect(LIVE_WORKFLOW_FIELD.step(5, 'gate')).toBe('steps.5.gate');
    expect(LIVE_WORKFLOW_FIELD.step(7, 'captures')).toBe('steps.7.captures');
  });
});

describe('readFieldPath', () => {
  it('returns null for non-element targets', () => {
    expect(readFieldPath(null)).toBeNull();
    expect(readFieldPath(document)).toBeNull();
  });

  it('returns the data-field-path attribute when set on the target', () => {
    const el = document.createElement('div');
    el.setAttribute('data-field-path', 'name');
    expect(readFieldPath(el)).toBe('name');
  });

  it('walks up to the nearest ancestor carrying data-field-path', () => {
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-field-path', 'manualOverride.value');
    const inner = document.createElement('input');
    wrapper.appendChild(inner);
    expect(readFieldPath(inner)).toBe('manualOverride.value');
  });

  it('returns null when no ancestor carries the attribute', () => {
    const el = document.createElement('div');
    const inner = document.createElement('input');
    el.appendChild(inner);
    expect(readFieldPath(inner)).toBeNull();
  });
});
