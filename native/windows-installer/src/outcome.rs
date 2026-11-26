//! How a run ends: the exit code its caller reads and, where a person
//! watches, the one sentence they are told.

/// Exit code of a run that installed the package (and opened the app,
/// unless told not to).
pub const EXIT_INSTALLED: i32 = 0;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Failure {
    Unexpected,
    BadSwitches,
    WindowsTooOld,
    SMode,
    PolicyBlocks,
    /// The pointer could not be read.
    Pointer,
    /// The pointer was read and names no package for this PC, or the
    /// channel has published none.
    NothingPublished,
    Download,
    Hash,
    Signature,
    WindowsRefused,
    /// Installed, and the app could not be opened.
    NotOpened,
    Cancelled,
}

impl Failure {
    pub fn exit_code(self) -> i32 {
        match self {
            Failure::Unexpected => 1,
            Failure::BadSwitches => 2,
            Failure::WindowsTooOld => 10,
            Failure::SMode => 11,
            Failure::PolicyBlocks => 12,
            Failure::Pointer | Failure::NothingPublished => 20,
            Failure::Download => 21,
            Failure::Hash => 22,
            Failure::Signature => 23,
            Failure::WindowsRefused => 30,
            Failure::NotOpened => 31,
            Failure::Cancelled => 40,
        }
    }

    pub fn sentence(self) -> &'static str {
        match self {
            Failure::Unexpected | Failure::BadSwitches => "OpenHeaders couldn't be installed.",
            Failure::WindowsTooOld => "OpenHeaders needs Windows 10 version 2004 or later.",
            Failure::SMode => "OpenHeaders can't be installed on Windows in S mode.",
            Failure::PolicyBlocks => "This PC's policy blocks app packages.",
            Failure::Pointer => "Couldn't reach the download. Check your connection.",
            Failure::NothingPublished => "There is no OpenHeaders package for this PC yet.",
            Failure::Download => "The download didn't finish. Check your connection.",
            Failure::Hash | Failure::Signature => "The download doesn't match what was published.",
            Failure::WindowsRefused => "Windows couldn't install OpenHeaders.",
            Failure::NotOpened => "OpenHeaders is installed. Open it from the Start menu.",
            Failure::Cancelled => "The install was cancelled.",
        }
    }

    /// Whether running the same steps again can end otherwise.
    pub fn worth_another_try(self) -> bool {
        matches!(
            self,
            Failure::Pointer | Failure::Download | Failure::Hash | Failure::WindowsRefused | Failure::Unexpected
        )
    }
}

/// A run that stopped: what kind, and the detail the log keeps.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Stop {
    pub failure: Failure,
    pub detail: String,
}

impl Stop {
    pub fn new(failure: Failure, detail: impl Into<String>) -> Self {
        Stop {
            failure,
            detail: detail.into(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const ALL: [Failure; 13] = [
        Failure::Unexpected,
        Failure::BadSwitches,
        Failure::WindowsTooOld,
        Failure::SMode,
        Failure::PolicyBlocks,
        Failure::Pointer,
        Failure::NothingPublished,
        Failure::Download,
        Failure::Hash,
        Failure::Signature,
        Failure::WindowsRefused,
        Failure::NotOpened,
        Failure::Cancelled,
    ];

    #[test]
    fn exit_codes_are_the_published_ones() {
        let codes: Vec<i32> = ALL.iter().map(|failure| failure.exit_code()).collect();
        assert_eq!(codes, [1, 2, 10, 11, 12, 20, 20, 21, 22, 23, 30, 31, 40]);
    }

    #[test]
    fn no_failure_ends_with_the_installed_code() {
        assert!(ALL.iter().all(|failure| failure.exit_code() != EXIT_INSTALLED));
    }

    #[test]
    fn every_failure_has_one_short_sentence() {
        for failure in ALL {
            let sentence = failure.sentence();
            assert!(!sentence.is_empty() && sentence.len() <= 60, "{failure:?}: {sentence}");
            assert!(!sentence.contains('\n'));
        }
    }

    #[test]
    fn a_refusal_of_this_pc_is_not_tried_again() {
        for failure in [
            Failure::WindowsTooOld,
            Failure::SMode,
            Failure::PolicyBlocks,
            Failure::NothingPublished,
        ] {
            assert!(!failure.worth_another_try(), "{failure:?}");
        }
        assert!(Failure::Download.worth_another_try());
    }
}
