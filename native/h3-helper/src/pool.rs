//! Per-origin QUIC connection pool. A connection is reusable only by a
//! hop whose ENTIRE trust and transport tuple matches the one it was
//! dialed with — origin, verification mode, client certificate, address
//! pin, cipher restriction, idle ceiling — so a pooled connection never
//! serves a hop with different trust. The failure discipline is
//! retry-once-on-stale: a reused connection failing before any response
//! bytes came back is discarded and the hop redials fresh ONCE; fresh
//! dials keep the honest one-shot failure story. `captureNetwork` hops
//! bypass the pool entirely (observation needs the dial).

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use bytes::Bytes;
use h3::client::SendRequest;
use h3_quinn::OpenStreams;

use crate::protocol::RequestHead;

/// Everything that shapes a connection's trust and transport. Two heads
/// agreeing on this key may share a connection; any difference dials
/// fresh. Client-certificate PEMs key by content — rotation re-dials.
#[derive(Clone, PartialEq, Eq, Hash)]
pub struct PoolKey {
    host: String,
    port: u16,
    insecure: bool,
    client_cert: Option<(String, String)>,
    connect_address: Option<String>,
    cipher_suites: Option<Vec<String>>,
    idle_timeout_ms: Option<u64>,
}

impl PoolKey {
    pub fn of(host: &str, port: u16, head: &RequestHead) -> Self {
        Self {
            host: host.to_string(),
            port,
            insecure: head.insecure,
            client_cert: head.client_cert.as_ref().map(|cc| (cc.cert_pem.clone(), cc.key_pem.clone())),
            connect_address: head.connect_address.clone(),
            cipher_suites: head.cipher_suites.clone(),
            idle_timeout_ms: head.idle_timeout_ms,
        }
    }
}

/// A fresh dial's live parts, handed to the pool (or kept by the hop
/// when the pool declines them — capture, or a concurrent dial won the
/// slot). Winds the connection down on drop, so an un-pooled hop —
/// including one whose task was canceled mid-exchange — never leaks
/// its endpoint past its own lifetime.
pub struct FreshConnection {
    pub endpoint: quinn::Endpoint,
    pub send_request: SendRequest<OpenStreams, Bytes>,
    pub drive: tokio::task::JoinHandle<()>,
}

impl Drop for FreshConnection {
    fn drop(&mut self) {
        self.drive.abort();
        self.endpoint.close(0u32.into(), b"done");
    }
}

struct Entry {
    connection: FreshConnection,
    generation: u64,
}

/// A checkout: a request handle cloned off the pooled connection, plus
/// the generation to name on `discard` if reuse proves it stale.
pub struct PooledConnection {
    pub send_request: SendRequest<OpenStreams, Bytes>,
    pub generation: u64,
}

pub enum StoreOutcome {
    /// The pool took ownership; the generation names the entry for a
    /// targeted `discard` if its very first exchange fails.
    Stored(u64),
    /// A concurrent dial already holds the slot — the connection comes
    /// back and the hop keeps ownership (used once, then shut down).
    Raced(FreshConnection),
}

#[derive(Default)]
pub struct Pool {
    entries: Mutex<HashMap<PoolKey, Entry>>,
    generations: AtomicU64,
}

impl Pool {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn checkout(&self, key: &PoolKey) -> Option<PooledConnection> {
        let entries = self.entries.lock().expect("pool lock");
        entries.get(key).map(|entry| PooledConnection {
            send_request: entry.connection.send_request.clone(),
            generation: entry.generation,
        })
    }

    /// Remove the entry — but only the generation that proved stale; a
    /// fresh replacement another hop already stored stays untouched.
    pub fn discard(&self, key: &PoolKey, generation: u64) {
        let mut entries = self.entries.lock().expect("pool lock");
        if entries.get(key).is_some_and(|entry| entry.generation == generation) {
            entries.remove(key);
        }
    }

    /// Drop entries whose h3 driver already wound down — the QUIC
    /// connection is closed (idle timeout, server close), so the next
    /// checkout could only ever find them stale. Called from the main
    /// loop's idle tick; without it a dead connection for a key nobody
    /// asks about again would sit in the map until process exit.
    pub fn sweep(&self) {
        let mut entries = self.entries.lock().expect("pool lock");
        entries.retain(|_, entry| !entry.connection.drive.is_finished());
    }

    /// Offer a fresh connection for reuse. Never replaces a live entry
    /// — dropping one would close an endpoint a concurrent hop may be
    /// streaming on — so a raced offer hands the connection back.
    pub fn store(&self, key: PoolKey, connection: FreshConnection) -> StoreOutcome {
        let mut entries = self.entries.lock().expect("pool lock");
        if entries.contains_key(&key) {
            return StoreOutcome::Raced(connection);
        }
        let generation = self.generations.fetch_add(1, Ordering::Relaxed);
        entries.insert(key, Entry { connection, generation });
        StoreOutcome::Stored(generation)
    }
}
