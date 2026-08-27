/**
 * useCertificateSummary — the read-side projection of one PEM blob,
 * computed asynchronously (WebCrypto SHA-256) and re-run only when the
 * PEM text changes. Rows and the add flow share it.
 */

import { useEffect, useState } from 'react';
import { gateTrustedRootPem, type TrustedRootGate } from './add-gate';

export type CertificateSummaryState = { status: 'pending' } | { status: 'settled'; gate: TrustedRootGate };

const PENDING: CertificateSummaryState = { status: 'pending' };

export function useCertificateSummary(pem: string): CertificateSummaryState {
  const [state, setState] = useState<CertificateSummaryState>(PENDING);
  useEffect(() => {
    let alive = true;
    setState(PENDING);
    void gateTrustedRootPem(pem).then((gate) => {
      if (alive) setState({ status: 'settled', gate });
    });
    return () => {
      alive = false;
    };
  }, [pem]);
  return state;
}
