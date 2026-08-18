/**
 * Protobuf spec → collection generation plan (the gRPC-client plan
 * Phase G) — the pure derivation behind the proto spec editor's
 * Generate Collection action.
 *
 * The plan rides the gRPC method derivation (`deriveGrpcMethods` —
 * registry rebuilt from the spec's saved files, never the editor
 * buffer): one GrpcRequest per rpc named after it, its message
 * pre-filled with the rpc's synthesized example so every generated
 * request is invokable immediately, specLink bound ids-only. Requests
 * group per service; the landing loop folders them only when the spec
 * declares more than one service (a single-service spec lands flat —
 * no pointless wrapper). Unparseable files and unresolved references
 * surface on the plan, never thrown — what resolved still generates.
 */

import type { ProtoRegistryIssue } from '@openheaders/core/proto';
import type { GrpcRequest, Spec } from '@openheaders/core/types';
import {
  deriveGrpcMethods,
  type GrpcParseFailure,
  synthesizeExampleText,
} from '../grpc-request-editor/method-selector';

export interface ProtoRequestPlan {
  /** Request name — the rpc's own name (`GetBook`). */
  name: string;
  seed: Partial<GrpcRequest>;
}

export interface ProtoServicePlan {
  /** Service full name (`library.v1.Library`) — the folder name when
   *  the plan folders at all. */
  service: string;
  requests: ProtoRequestPlan[];
}

export interface ProtoCollectionPlan {
  services: ProtoServicePlan[];
  methodCount: number;
  parseFailures: GrpcParseFailure[];
  issues: readonly ProtoRegistryIssue[];
}

/** Derive the generation plan from a Protobuf spec's saved files. */
export function buildProtoCollectionPlan(spec: Spec): ProtoCollectionPlan {
  const derivation = deriveGrpcMethods(spec);
  const services: ProtoServicePlan[] = derivation.groups.map((group) => ({
    service: group.service,
    requests: group.options.map((option) => {
      const method = { service: option.service, rpc: option.rpc };
      const example = synthesizeExampleText(derivation, method);
      return {
        name: option.rpc,
        seed: {
          method,
          specLink: { specUid: spec.uid },
          ...(example !== null ? { message: example } : {}),
        },
      };
    }),
  }));
  return {
    services,
    methodCount: services.reduce((n, s) => n + s.requests.length, 0),
    parseFailures: derivation.parseFailures,
    issues: derivation.issues,
  };
}
