//! The wire, through Windows' own HTTP stack: the system's proxy
//! settings and its certificate store, as every other program on the PC
//! that reaches the network has them.

use core::ffi::c_void;
use std::ptr::{null, null_mut};

use windows::Win32::Networking::WinHttp::{
    WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY, WINHTTP_ADDREQ_FLAG_ADD, WINHTTP_FLAG_SECURE, WINHTTP_QUERY_FLAG_NUMBER,
    WINHTTP_QUERY_STATUS_CODE, WinHttpAddRequestHeaders, WinHttpCloseHandle, WinHttpConnect, WinHttpOpen,
    WinHttpOpenRequest, WinHttpQueryHeaders, WinHttpReadData, WinHttpReceiveResponse, WinHttpSendRequest,
    WinHttpSetTimeouts,
};
use windows::core::{Error, HSTRING, PCWSTR, w};

use crate::transfer::{Body, Flow, Transport, split_https_url};

const RESOLVE_AND_CONNECT_MS: i32 = 15_000;
const SEND_AND_RECEIVE_MS: i32 = 30_000;
const PIECE_BYTES: usize = 256 * 1024;

/// A WinHTTP handle, closed when it goes.
struct Handle(*mut c_void);

impl Handle {
    fn of(raw: *mut c_void, what: &str) -> Result<Handle, String> {
        if raw.is_null() {
            Err(format!("{what}: {}", Error::from_thread().message()))
        } else {
            Ok(Handle(raw))
        }
    }
}

impl Drop for Handle {
    fn drop(&mut self) {
        let _ = unsafe { WinHttpCloseHandle(self.0) };
    }
}

pub struct WinHttp {
    session: Handle,
}

impl WinHttp {
    pub fn open(agent: &str) -> Result<WinHttp, String> {
        let session = Handle::of(
            unsafe {
                WinHttpOpen(
                    &HSTRING::from(agent),
                    WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY,
                    PCWSTR::null(),
                    PCWSTR::null(),
                    0,
                )
            },
            "opening the network session",
        )?;
        unsafe {
            WinHttpSetTimeouts(
                session.0,
                RESOLVE_AND_CONNECT_MS,
                RESOLVE_AND_CONNECT_MS,
                SEND_AND_RECEIVE_MS,
                SEND_AND_RECEIVE_MS,
            )
        }
        .map_err(|error| format!("setting the network timeouts: {}", error.message()))?;
        Ok(WinHttp { session })
    }
}

impl Transport for WinHttp {
    fn get(&self, url: &str, from: u64, body: &mut dyn Body) -> Result<(), String> {
        let (host, port, path) = split_https_url(url).ok_or_else(|| format!("{url} is not an https link"))?;
        let said = |what: &str, error: Error| format!("{what} {host}: {}", error.message());

        let connection = Handle::of(
            unsafe { WinHttpConnect(self.session.0, &HSTRING::from(host.as_str()), port, 0) },
            "connecting",
        )?;
        let request = Handle::of(
            unsafe {
                WinHttpOpenRequest(
                    connection.0,
                    w!("GET"),
                    &HSTRING::from(path.as_str()),
                    PCWSTR::null(),
                    PCWSTR::null(),
                    null(),
                    WINHTTP_FLAG_SECURE,
                )
            },
            "opening the request",
        )?;
        if from > 0 {
            let range: Vec<u16> = format!("Range: bytes={from}-").encode_utf16().collect();
            unsafe { WinHttpAddRequestHeaders(request.0, &range, WINHTTP_ADDREQ_FLAG_ADD) }
                .map_err(|error| said("asking a range of", error))?;
        }
        unsafe { WinHttpSendRequest(request.0, None, None, 0, 0, 0) }.map_err(|error| said("reaching", error))?;
        unsafe { WinHttpReceiveResponse(request.0, null_mut()) }.map_err(|error| said("waiting for", error))?;

        let mut status = 0u32;
        let mut status_size = size_of::<u32>() as u32;
        unsafe {
            WinHttpQueryHeaders(
                request.0,
                WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
                PCWSTR::null(),
                Some((&raw mut status).cast::<c_void>()),
                &raw mut status_size,
                null_mut(),
            )
        }
        .map_err(|error| said("reading the answer of", error))?;
        if body.begin(u16::try_from(status).unwrap_or(0)) == Flow::Stop {
            return Ok(());
        }

        let mut piece = vec![0u8; PIECE_BYTES];
        loop {
            let mut read = 0u32;
            unsafe {
                WinHttpReadData(
                    request.0,
                    piece.as_mut_ptr().cast::<c_void>(),
                    piece.len() as u32,
                    &raw mut read,
                )
            }
            .map_err(|error| said("reading from", error))?;
            if read == 0 || body.piece(&piece[..read as usize]) == Flow::Stop {
                return Ok(());
            }
        }
    }
}
