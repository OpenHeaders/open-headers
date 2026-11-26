/**
 * The launch aliases of a Windows package, as the host reads them: at
 * mount, and again whenever the window takes focus — a person switches an
 * alias back on in Windows Settings and comes back. Null on every host
 * that registers no `packageAliases` capability, and until the first
 * answer lands.
 */

import { getCapability, type PackageAliasState } from '@openheaders/core/capabilities';
import React from 'react';

export interface PackageAliasesReading {
  readonly app: PackageAliasState;
  readonly helper: PackageAliasState;
  /** Opens the Windows Settings page that holds the alias switches. */
  readonly openSettings: () => void;
}

export function usePackageAliases(): PackageAliasesReading | null {
  const [reading, setReading] = React.useState<PackageAliasesReading | null>(null);
  React.useEffect(() => {
    const aliases = getCapability('packageAliases')?.();
    if (!aliases) return;
    let alive = true;
    const read = (): void => {
      void aliases
        .read()
        .then((states) => {
          if (alive) setReading({ app: states.app, helper: states.helper, openSettings: aliases.openSettings });
        })
        .catch(() => undefined);
    };
    read();
    window.addEventListener('focus', read);
    return () => {
      alive = false;
      window.removeEventListener('focus', read);
    };
  }, []);
  return reading;
}
