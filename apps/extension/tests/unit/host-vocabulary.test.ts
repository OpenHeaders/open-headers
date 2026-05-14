import { describe, expect, it } from 'vitest';
import {
  getCurrentHost,
  instanceLabel,
  instanceLabelPlural,
  instanceLabelTitleCase,
} from '@openheaders/ui/shared/host-vocabulary';

describe('host-vocabulary', () => {
  it('defaults the current host to extension', () => {
    expect(getCurrentHost()).toBe('extension');
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
    expect(instanceLabel()).toBe(instanceLabel(getCurrentHost()));
    expect(instanceLabelPlural()).toBe(instanceLabelPlural(getCurrentHost()));
  });

  it('instanceLabelTitleCase capitalizes the first letter', () => {
    expect(instanceLabelTitleCase('extension')).toBe('Tab');
    expect(instanceLabelTitleCase('desktop')).toBe('Window');
  });
});
