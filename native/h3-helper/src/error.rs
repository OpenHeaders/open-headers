//! Failure → closed-set error code mapping. The helper picks the most
//! specific code it can prove; the node classifier owns the
//! user-facing message. New codes require a protocol bump.

pub struct HelperError {
    pub code: &'static str,
    pub message: String,
}

impl HelperError {
    pub fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self { code, message: message.into() }
    }
}

/// Classify a wire-phase failure from its display text. Display-based
/// on purpose: the quinn/h3 error enums are pre-1.0 and reshuffle
/// between releases, while their messages name the condition stably
/// ("certificate", "timed out", "alert", "reset"). `phase` is
/// `"connect"` (dial + handshake) or `"h3"` (request/response exchange).
pub fn wire_error(phase: &str, err: impl std::fmt::Display) -> HelperError {
    let message = format!("{phase}: {err}");
    let lower = message.to_lowercase();
    let code = if lower.contains("certificate") || lower.contains("unknownissuer") || lower.contains("invalid peer") {
        "tls-verify"
    } else if lower.contains("alert") || lower.contains("handshake") || lower.contains("crypto") {
        "tls-handshake"
    } else if lower.contains("timed out") || lower.contains("timeout") {
        // QUIC gets no RST-style refusal — a dial nobody answers times
        // out, which is UDP's "nothing speaks HTTP/3 here".
        if phase == "connect" {
            "connect-timeout"
        } else {
            "idle-timeout"
        }
    } else if lower.contains("reset") || lower.contains("stopped") {
        "reset"
    } else if lower.contains("unreachable") || lower.contains("refused") {
        "connect-refused"
    } else if phase == "h3" {
        "h3-protocol"
    } else {
        "quic-transport"
    };
    HelperError::new(code, message)
}
