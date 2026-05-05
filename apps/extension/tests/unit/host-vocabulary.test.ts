import { describe, expect, it } from 'vitest';
import {
  CURRENT_HOST,
  instanceLabel,
  instanceLabelPlural,
  instanceLabelTitleCase,
} from '@/shared/host-vocabulary';

describe('host-vocabulary', () => {
  it('CURRENT_HOST is extension in this build', () => {
    expect(CURRENT_HOST).toBe('extension');
  });

  it('extension + web hosts label instances as "tab"', () => {
    expect(instanceLabel('extension')).toBe('tab');
    expect(instanceLabel('web')).toBe('tab');
    expect(instanceLabelPlural('extension')).toBe('tabs');
    expect(instanceLabelPlural('web')).toBe('tabs');
  });

  it('desktop host labels instances as "window"', () => {
    expect(instanceLabel('desktop')).toBe('window');
    expect(instanceLabelPlural('desktop')).toBe('windows');
  });

  it('default host is the current build host', () => {
    expect(instanceLabel()).toBe(instanceLabel(CURRENT_HOST));
    expect(instanceLabelPlural()).toBe(instanceLabelPlural(CURRENT_HOST));
  });

  it('instanceLabelTitleCase capitalizes the first letter', () => {
    expect(instanceLabelTitleCase('extension')).toBe('Tab');
    expect(instanceLabelTitleCase('desktop')).toBe('Window');
  });
});
