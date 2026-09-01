/**
 * Request-signing auth schemes — pure, host-neutral signers the wire
 * executors call at dispatch time (after pre-request scripts have had
 * their say). One module per scheme; WebCrypto only, except HTTP
 * digest's MD5 leg, which the caller supplies (see `http-digest.ts`).
 */

export {
  AWS_SIGV4_DEFAULT_REGION,
  AWS_SIGV4_QUERY_EXPIRES_SECONDS,
  AWS_SIGV4_UNSIGNED_PAYLOAD,
  type AwsSigV4Credentials,
  type AwsSigV4Signed,
  type AwsSigV4SignInput,
  deriveAwsScope,
  resolveAwsScope,
  sha256Hex,
  signAwsSigV4,
} from './aws-sigv4';
export {
  buildHawkNormalizedString,
  type HawkAlgorithm,
  type HawkCredentials,
  type HawkSignInput,
  hawkPayloadHash,
  signHawk,
} from './hawk';
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
export {
  isJwtAlgorithm,
  JWT_ALGORITHMS,
  type JwtAlgorithm,
  type JwtCredentials,
  type JwtSignInput,
  type JwtSignResult,
  signJwtBearer,
} from './jwt';
export {
  buildOAuth1SignatureBaseString,
  type OAuth1Credentials,
  type OAuth1SignatureMethod,
  type OAuth1SignInput,
  type OAuth1SignResult,
  signOAuth1,
} from './oauth1';
export { pemToPkcs8 } from './pem';
