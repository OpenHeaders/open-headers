/**
 * FaultProbe — renders nothing, and throws a real render error while its
 * unit is armed (see `fault-injection.ts`). Mounted as the first child
 * inside a containment boundary so the throw is caught by exactly that
 * boundary.
 */

import type React from 'react';
import { useSyncExternalStore } from 'react';
import { type FaultUnit, faultUnitKey, InjectedFaultError, isFaultArmed, subscribeFaults } from './fault-injection';

interface FaultProbeProps {
  unit: FaultUnit;
}

const FaultProbe: React.FC<FaultProbeProps> = ({ unit }) => {
  const armed = useSyncExternalStore(subscribeFaults, () => isFaultArmed(unit));
  if (armed) throw new InjectedFaultError(`render fault injected into ${faultUnitKey(unit)}`);
  return null;
};

export default FaultProbe;
