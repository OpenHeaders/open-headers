import type * as v from 'valibot';
import type {
  HashicorpAuthMethodSchema,
  OnePasswordAuthLaneSchema,
  SecretManagerConnectionConfigSchema,
  SecretManagerConnectionSchema,
  SecretManagerConnectionsSchema,
} from '../schemas/secret-manager-connections';

export type OnePasswordAuthLane = v.InferOutput<typeof OnePasswordAuthLaneSchema>;
export type HashicorpAuthMethod = v.InferOutput<typeof HashicorpAuthMethodSchema>;
export type SecretManagerConnectionConfig = v.InferOutput<typeof SecretManagerConnectionConfigSchema>;
export type SecretManagerConnection = v.InferOutput<typeof SecretManagerConnectionSchema>;
export type SecretManagerConnections = v.InferOutput<typeof SecretManagerConnectionsSchema>;

export const EMPTY_SECRET_MANAGER_CONNECTIONS: SecretManagerConnections = { connections: [] };
