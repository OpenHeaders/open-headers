//! Per-request rustls `ClientConfig` — the TLS trust legs carried over
//! the framed protocol mapped onto rustls, which inherits NOTHING from
//! Node/OpenSSL: webpki-roots (the Mozilla bundle — parity with Node's
//! bundled roots) by default, the insecure verifier for
//! `sslVerification: false`, client-certificate auth from PEM material.
//! QUIC is TLS 1.3-only; ALPN offers `h3` and nothing else.

use std::sync::Arc;

use rustls::client::danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier};
use rustls::crypto::CryptoProvider;
use rustls::pki_types::{CertificateDer, PrivateKeyDer, ServerName, UnixTime};
use rustls::{ClientConfig, DigitallySignedStruct, RootCertStore, SignatureScheme};

use crate::error::HelperError;
use crate::protocol::RequestHead;

/// The `sslVerification: false` leg: accept any server certificate.
/// The handshake itself still runs full TLS 1.3 — only chain and name
/// verification are waived, the same contract as the Node stack's
/// `rejectUnauthorized: false`.
#[derive(Debug)]
struct InsecureVerifier {
    provider: Arc<CryptoProvider>,
}

impl ServerCertVerifier for InsecureVerifier {
    fn verify_server_cert(
        &self,
        _end_entity: &CertificateDer<'_>,
        _intermediates: &[CertificateDer<'_>],
        _server_name: &ServerName<'_>,
        _ocsp_response: &[u8],
        _now: UnixTime,
    ) -> Result<ServerCertVerified, rustls::Error> {
        Ok(ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(
        &self,
        _message: &[u8],
        _cert: &CertificateDer<'_>,
        _dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        Ok(HandshakeSignatureValid::assertion())
    }

    fn verify_tls13_signature(
        &self,
        _message: &[u8],
        _cert: &CertificateDer<'_>,
        _dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        Ok(HandshakeSignatureValid::assertion())
    }

    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        self.provider.signature_verification_algorithms.supported_schemes()
    }
}

fn parse_client_cert(cert_pem: &str, key_pem: &str) -> Result<(Vec<CertificateDer<'static>>, PrivateKeyDer<'static>), HelperError> {
    let certs: Vec<CertificateDer<'static>> = rustls_pemfile::certs(&mut cert_pem.as_bytes())
        .collect::<Result<_, _>>()
        .map_err(|e| HelperError::new("bad-request", format!("client certificate PEM: {e}")))?;
    if certs.is_empty() {
        return Err(HelperError::new("bad-request", "client certificate PEM holds no certificate"));
    }
    let key = rustls_pemfile::private_key(&mut key_pem.as_bytes())
        .map_err(|e| HelperError::new("bad-request", format!("client key PEM: {e}")))?
        .ok_or_else(|| HelperError::new("bad-request", "client key PEM holds no private key"))?;
    Ok((certs, key))
}

pub fn client_config(head: &RequestHead) -> Result<ClientConfig, HelperError> {
    let provider = Arc::new(rustls::crypto::ring::default_provider());
    let builder = ClientConfig::builder_with_provider(provider.clone())
        .with_protocol_versions(&[&rustls::version::TLS13])
        .map_err(|e| HelperError::new("internal", format!("TLS 1.3 config: {e}")))?;
    let builder = if head.insecure {
        builder
            .dangerous()
            .with_custom_certificate_verifier(Arc::new(InsecureVerifier { provider }))
    } else {
        let mut roots = RootCertStore::empty();
        roots.extend(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());
        builder.with_root_certificates(roots)
    };
    let mut config = match &head.client_cert {
        Some(cc) => {
            let (certs, key) = parse_client_cert(&cc.cert_pem, &cc.key_pem)?;
            builder
                .with_client_auth_cert(certs, key)
                .map_err(|e| HelperError::new("bad-request", format!("client certificate: {e}")))?
        }
        None => builder.with_no_client_auth(),
    };
    config.alpn_protocols = vec![b"h3".to_vec()];
    Ok(config)
}
