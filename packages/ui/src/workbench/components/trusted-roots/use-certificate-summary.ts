/**
 * useCertificateSummary — the read-side projection of one PEM blob,
 * computed asynchronously (WebCrypto SHA-256) and re-run only when the
 * PEM text changes. Rows and the add flow share it.
 */

import { useEffect, useState } from 'react';
import { gateTrustedRootPem, type TrustedRootGate, type TrustedRootGateOptions } from './add-gate';

export type CertificateSummaryState = { status: 'pending' } | { status: 'settled'; gate: TrustedRootGate };

const PENDING: CertificateSummaryState = { status: 'pending' };

const ROW_PROJECTION: TrustedRootGateOptions = { requireCa: false };

export function useCertificateSummary(
  pem: string,
  options: TrustedRootGateOptions = ROW_PROJECTION,
): CertificateSummaryState {
  const [state, setState] = useState<CertificateSummaryState>(PENDING);
  const requireCa = options.requireCa;
  useEffect(() => {
    let alive = true;
    setState(PENDING);
    void gateTrustedRootPem(pem, { requireCa }).then((gate) => {
      if (alive) setState({ status: 'settled', gate });
    });
    return () => {
      alive = false;
    };
  }, [pem, requireCa]);
  return state;
}
