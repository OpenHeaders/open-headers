//! The framed stdio protocol's Rust twin — frame type ids and control
//! payload shapes. The contract is `docs/REQUEST_ENGINE_H3_PROTOCOL.md`;
//! the TypeScript twin is `oracle-host-node/src/live/h3-helper/protocol.ts`.
//! Any wire-shape change bumps `PROTOCOL_VERSION` on both sides.

use serde::{Deserialize, Serialize};

pub const PROTOCOL_VERSION: u32 = 3;

pub mod frame_type {
    pub const HELLO: u8 = 0x01;
    pub const REQUEST: u8 = 0x10;
    pub const REQUEST_BODY: u8 = 0x11;
    pub const REQUEST_END: u8 = 0x12;
    pub const CANCEL: u8 = 0x1f;
    pub const RESPONSE_HEAD: u8 = 0x20;
    pub const RESPONSE_BODY: u8 = 0x21;
    pub const RESPONSE_TRAILERS: u8 = 0x22;
    pub const RESPONSE_END: u8 = 0x23;
    pub const ERROR: u8 = 0x2e;
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Hello {
    pub protocol: u32,
    pub helper: &'static str,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientCert {
    pub cert_pem: String,
    /// PKCS#8 PEM, already decrypted node-side — a passphrase never
    /// crosses the protocol.
    pub key_pem: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestHead {
    pub url: String,
    pub method: String,
    /// User-set Host header, already folded out of `headers` node-side —
    /// overrides the URL's host as `:authority`.
    #[serde(default)]
    pub authority: Option<String>,
    pub headers: Vec<(String, String)>,
    pub body_bytes: u64,
    #[serde(default)]
    pub insecure: bool,
    #[serde(default)]
    pub client_cert: Option<ClientCert>,
    /// resolveToAddress pin — dial this IP; SNI and certificate
    /// verification keep the URL's host.
    #[serde(default)]
    pub connect_address: Option<String>,
    /// TLS 1.3 IANA suite names restricting the handshake's offer —
    /// the node side admits only names this helper's provider carries.
    #[serde(default)]
    pub cipher_suites: Option<Vec<String>>,
    #[serde(default)]
    pub idle_timeout_ms: Option<u64>,
    /// captureNetwork (v3): dial a fresh instrumented connection —
    /// never a pooled one — and report its socket facts + dial timings
    /// on RESPONSE_HEAD.
    #[serde(default)]
    pub capture_network: bool,
}

/// Endpoints of the instrumented dial's socket (v3) — the UDP socket
/// the QUIC connection rides.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SocketFacts {
    pub local_address: String,
    pub local_port: u16,
    pub remote_address: String,
    pub remote_port: u16,
}

/// Phase durations of the instrumented dial (v3). QUIC merges
/// transport establishment and TLS into ONE handshake, so there is no
/// TCP-connect leg — `handshake_ms` is the whole of it.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DialTimings {
    /// Absent when `connectAddress` pinned the dial — nothing resolved.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dns_ms: Option<f64>,
    pub handshake_ms: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResponseHead {
    pub status: u16,
    pub headers: Vec<(String, String)>,
    /// v3, present only on a `captureNetwork` head's instrumented dial.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub socket: Option<SocketFacts>,
    /// v3, present only on a `captureNetwork` head's instrumented dial.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timings: Option<DialTimings>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorFrame {
    pub code: &'static str,
    pub message: String,
}
