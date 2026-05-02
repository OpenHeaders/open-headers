import { describe, expect, it } from 'vitest';
import { shouldAutoUnpublishOnUpdate, UNIVERSAL_METADATA_KEYS } from '../../src/utils/publication-gate';

describe('shouldAutoUnpublishOnUpdate', () => {
  it('returns false for an empty update', () => {
    expect(shouldAutoUnpublishOnUpdate({})).toBe(false);
  });

  it('returns false when only universal metadata keys are touched', () => {
    expect(shouldAutoUnpublishOnUpdate({ name: 'X' })).toBe(false);
    expect(shouldAutoUnpublishOnUpdate({ description: 'Y' })).toBe(false);
    expect(shouldAutoUnpublishOnUpdate({ name: 'X', description: 'Y' })).toBe(false);
  });

  it('returns false when the explicit publish gesture is in flight', () => {
    expect(shouldAutoUnpublishOnUpdate({ published: true })).toBe(false);
    expect(shouldAutoUnpublishOnUpdate({ published: false })).toBe(false);
    // Even alongside runtime keys — the publish gesture itself is the
    // canonical writer of `published`, never the auto-augment branch.
    expect(shouldAutoUnpublishOnUpdate({ published: true, action: { redirectTo: 'https://example.test' } })).toBe(
      false,
    );
  });

  it('returns true when any runtime-affecting key is touched', () => {
    expect(shouldAutoUnpublishOnUpdate({ enabled: true })).toBe(true);
    expect(shouldAutoUnpublishOnUpdate({ conditions: [] })).toBe(true);
    expect(shouldAutoUnpublishOnUpdate({ steps: [] })).toBe(true);
    expect(shouldAutoUnpublishOnUpdate({ name: 'X', conditions: [] })).toBe(true);
  });

  it('treats per-entity extra metadata keys as universal-equivalent', () => {
    const extra = new Set<string>(['tags', 'notes']);
    expect(shouldAutoUnpublishOnUpdate({ tags: ['a'] }, extra)).toBe(false);
    expect(shouldAutoUnpublishOnUpdate({ notes: 'foo' }, extra)).toBe(false);
    expect(shouldAutoUnpublishOnUpdate({ name: 'X', tags: ['a'] }, extra)).toBe(false);
    // Extra keys don't shadow runtime keys; runtime still flips.
    expect(shouldAutoUnpublishOnUpdate({ tags: ['a'], conditions: [] }, extra)).toBe(true);
  });

  it('exposes the universal metadata key set as readonly', () => {
    expect(UNIVERSAL_METADATA_KEYS.has('name')).toBe(true);
    expect(UNIVERSAL_METADATA_KEYS.has('description')).toBe(true);
    expect(UNIVERSAL_METADATA_KEYS.has('published')).toBe(true);
    expect(UNIVERSAL_METADATA_KEYS.has('enabled')).toBe(false);
  });
});
