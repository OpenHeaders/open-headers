import type * as v from 'valibot';
import type { DeviceTrustedCertificateSchema, DeviceTrustSchema } from '../schemas/device-trust';

export type DeviceTrustedCertificate = v.InferOutput<typeof DeviceTrustedCertificateSchema>;

export type DeviceTrust = v.InferOutput<typeof DeviceTrustSchema>;

export const EMPTY_DEVICE_TRUST: DeviceTrust = { certificates: [], useSystemCa: false };
