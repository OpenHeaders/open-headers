/**
 * Device-trust bridge RPCs — the certificates THIS machine pins beside
 * the workspace's trusted certificates (the Trusted Roots plan, device
 * scope). Node-host answered: the browser runtime cannot apply trust
 * material, so the extension never serves these and its surfaces
 * self-gate on the request runtime.
 *
 * `probe` is the trust-on-failure primitive: a read-only dial with
 * verification off that returns the chain the server PRESENTS —
 * nothing is sent on it — so the response surface can show what it
 * would be trusting before the user pins it. Answers are renderer-safe
 * projections: PEM plus the derived summary, the same shape the
 * settings table renders.
 */

import type { DeviceTrustedCertificate } from '../../types';
import type { CertificateSummary } from '../../utils/certificate-summary';

/** One certificate of a presented chain, leaf first. */
export interface PresentedCertificateWire {
  pem: string;
  summary: CertificateSummary;
  /** Issuer equals subject and the chain ends here — the self-signed case. */
  selfSigned: boolean;
}

export interface DeviceTrustRpc {
  /** Every certificate this device pins, in trust order. */
  'oh.deviceTrust.list': {
    req: Record<string, never>;
    res: { certificates: DeviceTrustedCertificate[] };
  };
  /**
   * Pin one certificate (or chain, one row) on this device. Validated
   * (a parseable PEM certificate block), persisted, and applied to the
   * next dial — no restart. Echoes the minted row.
   */
  'oh.deviceTrust.add': {
    req: { certPem: string; name: string; origin?: string };
    res: { ok: true; certificate: DeviceTrustedCertificate } | { ok: false; error: string };
  };
  'oh.deviceTrust.remove': {
    req: { uid: string };
    res: { ok: true } | { ok: false; error: string };
  };
  /**
   * Read the chain a TLS server presents — a direct dial to
   * `host:port` with verification off, closed as soon as the handshake
   * completes; no request bytes are written. `servername` rides SNI
   * when the dial targets an address the certificate names differently.
   */
  'oh.deviceTrust.probe': {
    req: { host: string; port: number; servername?: string };
    res: { ok: true; chain: PresentedCertificateWire[] } | { ok: false; error: string };
  };
}
