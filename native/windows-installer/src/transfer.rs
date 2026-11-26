//! Reading from the feed: the pointer, small and whole, and the package,
//! large and to a file. The wire is behind [`Transport`]; what is decided
//! here is what a broken download does next. The download host answers
//! ranges, so a second try asks only for what the file still lacks.

use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::Path;

/// What a body's reader tells the transport after each piece.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Flow {
    Continue,
    Stop,
}

/// Where a response goes: its status first, then its body in pieces.
pub trait Body {
    fn begin(&mut self, status: u16) -> Flow;
    fn piece(&mut self, bytes: &[u8]) -> Flow;
}

pub trait Transport {
    /// One GET. `from` above zero asks for the bytes from that offset on.
    /// An error is a request that did not run to its end; a status the
    /// caller does not want is not one.
    fn get(&self, url: &str, from: u64, body: &mut dyn Body) -> Result<(), String>;
}

/// An `https` link as a connection needs it: the host, the port, and the
/// path with its query. `None` for anything else.
pub fn split_https_url(url: &str) -> Option<(String, u16, String)> {
    let rest = url.strip_prefix("https://")?;
    let rest = rest.split('#').next().unwrap_or(rest);
    let (authority, path) = match rest.find(['/', '?']) {
        Some(at) if rest[at..].starts_with('/') => (&rest[..at], rest[at..].to_string()),
        Some(at) => (&rest[..at], format!("/{}", &rest[at..])),
        None => (rest, "/".to_string()),
    };
    if authority.contains('@') {
        return None;
    }
    let (host, port) = match authority.rsplit_once(':') {
        Some((host, port)) => (host, port.parse().ok()?),
        None => (authority, 443),
    };
    let plain = !host.is_empty()
        && host
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'-'));
    plain.then(|| (host.to_string(), port, path))
}

struct Collected {
    status: u16,
    bytes: Vec<u8>,
    cap: usize,
    overflowed: bool,
}

impl Body for Collected {
    fn begin(&mut self, status: u16) -> Flow {
        self.status = status;
        if status == 200 { Flow::Continue } else { Flow::Stop }
    }

    fn piece(&mut self, bytes: &[u8]) -> Flow {
        if self.bytes.len() + bytes.len() > self.cap {
            self.overflowed = true;
            return Flow::Stop;
        }
        self.bytes.extend_from_slice(bytes);
        Flow::Continue
    }
}

/// A small file read whole: its status and, for a 200, its body.
pub fn read_small(transport: &dyn Transport, url: &str, cap: usize) -> Result<(u16, Vec<u8>), String> {
    let mut collected = Collected {
        status: 0,
        bytes: Vec::new(),
        cap,
        overflowed: false,
    };
    transport.get(url, 0, &mut collected)?;
    if collected.overflowed {
        return Err(format!("{url} is larger than {cap} bytes"));
    }
    Ok((collected.status, collected.bytes))
}

#[derive(Debug, PartialEq, Eq)]
pub enum DownloadError {
    Cancelled,
    Failed(String),
}

/// How many times a download is asked for before it is given up.
pub const DOWNLOAD_ATTEMPTS: u32 = 3;

/// The wait before try number `next` (2 or 3): 1 s, then 3 s.
pub fn pause_before(next: u32) -> u64 {
    if next <= 2 { 1_000 } else { 3_000 }
}

struct ToFile<'a> {
    path: &'a Path,
    file: Option<File>,
    asked_from: u64,
    have: u64,
    size: u64,
    refusal: Option<String>,
    cancelled: bool,
    on_bytes: &'a mut dyn FnMut(u64),
    is_cancelled: &'a dyn Fn() -> bool,
}

impl Body for ToFile<'_> {
    fn begin(&mut self, status: u16) -> Flow {
        let opened = match status {
            // The range was honoured: the body carries on where the file ends.
            206 if self.asked_from > 0 => OpenOptions::new().append(true).open(self.path),
            // The whole file, asked for or not: start over.
            200 => {
                self.have = 0;
                File::create(self.path)
            }
            other => {
                self.refusal = Some(format!("the download host answered {other}"));
                return Flow::Stop;
            }
        };
        match opened {
            Ok(file) => {
                self.file = Some(file);
                Flow::Continue
            }
            Err(error) => {
                self.refusal = Some(format!("cannot write {}: {error}", self.path.display()));
                Flow::Stop
            }
        }
    }

    fn piece(&mut self, bytes: &[u8]) -> Flow {
        let Some(file) = self.file.as_mut() else {
            return Flow::Stop;
        };
        if self.have + bytes.len() as u64 > self.size {
            self.refusal = Some(format!(
                "the download is longer than the {} bytes the pointer names",
                self.size
            ));
            return Flow::Stop;
        }
        if let Err(error) = file.write_all(bytes) {
            self.refusal = Some(format!("cannot write {}: {error}", self.path.display()));
            return Flow::Stop;
        }
        self.have += bytes.len() as u64;
        (self.on_bytes)(self.have);
        if (self.is_cancelled)() {
            self.cancelled = true;
            return Flow::Stop;
        }
        Flow::Continue
    }
}

/// Whether asking again can end otherwise: a host that says the file is
/// not there, or not for us, says so every time.
fn final_answer(refusal: &str) -> bool {
    ["400", "401", "403", "404", "410"]
        .iter()
        .any(|status| refusal.ends_with(&format!("answered {status}")))
}

/// What a download answers to while it runs.
pub struct Around<'a> {
    /// Waits the given milliseconds before another try.
    pub pause: &'a dyn Fn(u64),
    /// Hears the file's length as it grows.
    pub on_bytes: &'a mut dyn FnMut(u64),
    pub is_cancelled: &'a dyn Fn() -> bool,
    /// Takes a line for the log.
    pub note: &'a dyn Fn(&str),
}

/// Downloads `url` into `dest` until the file holds `size` bytes. What a
/// broken try left in the file is kept, and the next try asks for the
/// rest.
pub fn download(
    transport: &dyn Transport,
    url: &str,
    dest: &Path,
    size: u64,
    around: Around,
) -> Result<(), DownloadError> {
    let Around {
        pause,
        on_bytes,
        is_cancelled,
        note,
    } = around;
    let mut last = String::new();
    for attempt in 1..=DOWNLOAD_ATTEMPTS {
        if attempt > 1 {
            pause(pause_before(attempt));
        }
        if is_cancelled() {
            return Err(DownloadError::Cancelled);
        }
        let mut have = fs::metadata(dest).map(|meta| meta.len()).unwrap_or(0);
        if have > size {
            let _ = fs::remove_file(dest);
            have = 0;
        }
        if have == size {
            return Ok(());
        }
        note(&format!("download try {attempt}: asking from byte {have} of {size}"));
        let mut body = ToFile {
            path: dest,
            file: None,
            asked_from: have,
            have,
            size,
            refusal: None,
            cancelled: false,
            on_bytes: &mut *on_bytes,
            is_cancelled,
        };
        let sent = transport.get(url, have, &mut body);
        let (now, refusal, cancelled) = (body.have, body.refusal.take(), body.cancelled);
        drop(body);
        if cancelled {
            return Err(DownloadError::Cancelled);
        }
        last = match (refusal, sent) {
            (Some(refusal), _) => refusal,
            (None, Err(error)) => error,
            (None, Ok(())) if now == size => return Ok(()),
            (None, Ok(())) => format!("the download ended at byte {now} of {size}"),
        };
        note(&format!("download try {attempt} failed: {last}"));
        if final_answer(&last) {
            break;
        }
    }
    Err(DownloadError::Failed(last))
}

#[cfg(test)]
pub mod testing {
    use super::*;
    use std::cell::RefCell;
    use std::path::PathBuf;

    /// One scripted answer of the fake host.
    pub enum Answer {
        /// The status, then the body from the asked offset on, cut after
        /// `cut` bytes with a broken connection when it is set.
        Serve {
            ignore_range: bool,
            cut: Option<usize>,
        },
        Status(u16),
        Unreachable,
    }

    /// A host that holds one file and answers from a script, then serves
    /// plainly once the script is used up.
    pub struct FakeHost {
        pub content: Vec<u8>,
        pub script: RefCell<Vec<Answer>>,
        pub asked: RefCell<Vec<(String, u64)>>,
    }

    impl FakeHost {
        pub fn new(content: &[u8], script: Vec<Answer>) -> Self {
            FakeHost {
                content: content.to_vec(),
                script: RefCell::new(script),
                asked: RefCell::new(Vec::new()),
            }
        }
    }

    impl Transport for FakeHost {
        fn get(&self, url: &str, from: u64, body: &mut dyn Body) -> Result<(), String> {
            self.asked.borrow_mut().push((url.to_string(), from));
            let answer = if self.script.borrow().is_empty() {
                Answer::Serve {
                    ignore_range: false,
                    cut: None,
                }
            } else {
                self.script.borrow_mut().remove(0)
            };
            match answer {
                Answer::Unreachable => Err("the host could not be reached".to_string()),
                Answer::Status(status) => {
                    body.begin(status);
                    Ok(())
                }
                Answer::Serve { ignore_range, cut } => {
                    let ranged = from > 0 && !ignore_range;
                    let start = if ranged { from as usize } else { 0 };
                    if body.begin(if ranged { 206 } else { 200 }) == Flow::Stop {
                        return Ok(());
                    }
                    let rest = &self.content[start.min(self.content.len())..];
                    let sent = &rest[..cut.unwrap_or(rest.len()).min(rest.len())];
                    for piece in sent.chunks(7) {
                        if body.piece(piece) == Flow::Stop {
                            return Ok(());
                        }
                    }
                    if cut.is_some() {
                        Err("the connection was reset".to_string())
                    } else {
                        Ok(())
                    }
                }
            }
        }
    }

    /// A folder of this test's own under the system's temp folder.
    pub fn scratch_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("oh-installer-test-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }
}

#[cfg(test)]
mod tests {
    use super::testing::*;
    use super::*;
    use std::cell::{Cell, RefCell};

    const URL: &str = "https://updates.openheaders.io/dl/v2026.11.3-beta.6/OpenHeaders-2026.11.3-beta.6-x64.msix";
    const CONTENT: &[u8] = b"the bytes of a package, forty-six bytes long...";

    struct Run {
        result: Result<(), DownloadError>,
        pauses: Vec<u64>,
        heard: Vec<u64>,
        file: Vec<u8>,
    }

    fn run(name: &str, host: &FakeHost, left_over: Option<&[u8]>, cancel_at: Option<u64>) -> Run {
        let dir = scratch_dir(name);
        let dest = dir.join("package.msix");
        if let Some(bytes) = left_over {
            fs::write(&dest, bytes).unwrap();
        }
        let pauses = RefCell::new(Vec::new());
        let mut heard = Vec::new();
        let seen = Cell::new(0u64);
        let result = download(
            host,
            URL,
            &dest,
            CONTENT.len() as u64,
            Around {
                pause: &|ms| pauses.borrow_mut().push(ms),
                on_bytes: &mut |have| {
                    seen.set(have);
                    heard.push(have)
                },
                is_cancelled: &|| cancel_at.is_some_and(|at| seen.get() >= at),
                note: &|_| {},
            },
        );
        let file = fs::read(&dest).unwrap_or_default();
        let _ = fs::remove_dir_all(&dir);
        Run {
            result,
            pauses: pauses.into_inner(),
            heard,
            file,
        }
    }

    #[test]
    fn a_plain_download_lands_whole() {
        let host = FakeHost::new(CONTENT, vec![]);
        let run = run("plain", &host, None, None);
        assert_eq!(run.result, Ok(()));
        assert_eq!(run.file, CONTENT);
        assert_eq!(*host.asked.borrow(), [(URL.to_string(), 0)]);
        assert_eq!(run.heard.last(), Some(&(CONTENT.len() as u64)));
        assert!(run.pauses.is_empty());
    }

    #[test]
    fn a_broken_download_asks_for_the_rest() {
        let host = FakeHost::new(
            CONTENT,
            vec![Answer::Serve {
                ignore_range: false,
                cut: Some(14),
            }],
        );
        let run = run("resume", &host, None, None);
        assert_eq!(run.result, Ok(()));
        assert_eq!(run.file, CONTENT);
        assert_eq!(*host.asked.borrow(), [(URL.to_string(), 0), (URL.to_string(), 14)]);
        assert_eq!(run.pauses, [1_000]);
    }

    #[test]
    fn a_host_that_ignores_the_range_starts_the_file_over() {
        let host = FakeHost::new(
            CONTENT,
            vec![
                Answer::Serve {
                    ignore_range: false,
                    cut: Some(21),
                },
                Answer::Serve {
                    ignore_range: true,
                    cut: None,
                },
            ],
        );
        let run = run("no-range", &host, None, None);
        assert_eq!(run.result, Ok(()));
        assert_eq!(run.file, CONTENT);
    }

    #[test]
    fn three_tries_and_no_more() {
        let host = FakeHost::new(
            CONTENT,
            vec![Answer::Unreachable, Answer::Status(503), Answer::Unreachable],
        );
        let run = run("gives-up", &host, None, None);
        assert_eq!(
            run.result,
            Err(DownloadError::Failed("the host could not be reached".to_string()))
        );
        assert_eq!(host.asked.borrow().len(), 3);
        assert_eq!(run.pauses, [1_000, 3_000]);
    }

    #[test]
    fn a_file_that_is_not_there_is_not_asked_for_again() {
        let host = FakeHost::new(CONTENT, vec![Answer::Status(404)]);
        let run = run("missing", &host, None, None);
        assert_eq!(
            run.result,
            Err(DownloadError::Failed("the download host answered 404".to_string()))
        );
        assert_eq!(host.asked.borrow().len(), 1);
    }

    #[test]
    fn a_whole_file_left_from_before_is_not_downloaded_again() {
        let host = FakeHost::new(CONTENT, vec![]);
        let run = run("already", &host, Some(CONTENT), None);
        assert_eq!(run.result, Ok(()));
        assert!(host.asked.borrow().is_empty());
    }

    #[test]
    fn a_longer_file_left_from_before_is_thrown_away() {
        let host = FakeHost::new(CONTENT, vec![]);
        let longer = [CONTENT, b" and more"].concat();
        let run = run("longer", &host, Some(&longer), None);
        assert_eq!(run.result, Ok(()));
        assert_eq!(run.file, CONTENT);
        assert_eq!(*host.asked.borrow(), [(URL.to_string(), 0)]);
    }

    #[test]
    fn a_body_longer_than_the_pointer_says_is_refused() {
        let host = FakeHost::new(&[CONTENT, b"!"].concat(), vec![]);
        let run = run("too-long", &host, None, None);
        assert!(matches!(run.result, Err(DownloadError::Failed(ref why)) if why.contains("longer than")));
    }

    #[test]
    fn a_cancel_stops_at_the_next_piece_and_is_not_tried_again() {
        let host = FakeHost::new(CONTENT, vec![]);
        let run = run("cancel", &host, None, Some(14));
        assert_eq!(run.result, Err(DownloadError::Cancelled));
        assert_eq!(run.heard.last(), Some(&14));
        assert_eq!(host.asked.borrow().len(), 1);
    }

    #[test]
    fn an_https_link_splits_into_host_port_and_path() {
        assert_eq!(
            split_https_url("https://updates.openheaders.io/desktop/beta/windows-package.json"),
            Some((
                "updates.openheaders.io".to_string(),
                443,
                "/desktop/beta/windows-package.json".to_string()
            ))
        );
        assert_eq!(
            split_https_url("https://updates.openheaders.io:8443/dl/a.msix?x=1#top"),
            Some(("updates.openheaders.io".to_string(), 8443, "/dl/a.msix?x=1".to_string()))
        );
        assert_eq!(
            split_https_url("https://updates.openheaders.io"),
            Some(("updates.openheaders.io".to_string(), 443, "/".to_string()))
        );
    }

    #[test]
    fn a_link_that_is_not_plain_https_does_not_split() {
        for url in [
            "http://updates.openheaders.io/a",
            "https://john@updates.openheaders.io/a",
            "https:///a",
            "https://host:port/a",
            "file:///C:/a",
        ] {
            assert_eq!(split_https_url(url), None, "{url}");
        }
    }

    #[test]
    fn a_small_file_is_read_whole_with_its_status() {
        let host = FakeHost::new(b"{}", vec![]);
        assert_eq!(read_small(&host, URL, 16), Ok((200, b"{}".to_vec())));
        let missing = FakeHost::new(b"{}", vec![Answer::Status(404)]);
        assert_eq!(read_small(&missing, URL, 16), Ok((404, Vec::new())));
        let large = FakeHost::new(CONTENT, vec![]);
        assert!(read_small(&large, URL, 16).is_err());
        let down = FakeHost::new(b"{}", vec![Answer::Unreachable]);
        assert!(read_small(&down, URL, 16).is_err());
    }
}
