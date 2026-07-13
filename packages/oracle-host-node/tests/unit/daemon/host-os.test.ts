import { describe, expect, it } from 'vitest';
import { detectNodeHostOs, parseOsRelease } from '../../../src/daemon/host-os';

describe('parseOsRelease', () => {
  it('resolves distros from the ID field', () => {
    expect(parseOsRelease('NAME="Ubuntu"\nID=ubuntu\nID_LIKE=debian\nVERSION_ID="24.04"\n')).toBe('ubuntu');
    expect(parseOsRelease('ID=debian\nNAME="Debian GNU/Linux"\n')).toBe('debian');
    expect(parseOsRelease('ID=fedora\nNAME="Fedora Linux"\n')).toBe('fedora');
  });

  it('falls back to the ID_LIKE chain for derivatives', () => {
    expect(parseOsRelease('ID=linuxmint\nID_LIKE="ubuntu debian"\n')).toBe('ubuntu');
    expect(parseOsRelease('ID=centos\nID_LIKE="rhel fedora"\n')).toBe('fedora');
  });

  it('handles quoted values and reads unknown distros as plain linux', () => {
    expect(parseOsRelease('ID="alpine"\n')).toBe('linux');
    expect(parseOsRelease('')).toBe('linux');
  });
});

describe('detectNodeHostOs', () => {
  it('classifies the running platform to a PlatformKind', () => {
    const kind = detectNodeHostOs();
    // The test process runs on macOS (dev) or Linux (CI) — both must
    // resolve to a concrete mark, never the undefined fallthrough.
    expect(['macos', 'windows', 'ubuntu', 'debian', 'fedora', 'linux']).toContain(kind);
  });
});
