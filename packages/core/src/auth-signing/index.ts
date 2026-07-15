/**
 * Request-signing auth schemes — pure, host-neutral signers the wire
 * executors call at dispatch time (after pre-request scripts have had
 * their say). One module per scheme; WebCrypto only, except HTTP
 * digest's MD5 leg, which the caller supplies (see `http-digest.ts`).
 */

export {
  AWS_SIGV4_UNSIGNED_PAYLOAD,
  type AwsSigV4Credentials,
  type AwsSigV4SignInput,
  sha256Hex,
  signAwsSigV4,
} from './aws-sigv4';
export {
  buildDigestAuthorization,
  type DigestAlgorithm,
  type DigestAuthorizationInput,
  type DigestChallenge,
  type DigestCredentials,
  DigestError,
  type DigestHashFn,
  type DigestQop,
  parseDigestChallenges,
  selectDigestChallenge,
} from './http-digest';
