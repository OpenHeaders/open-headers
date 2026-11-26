//! What the installer's window shows, and where: the line, the bar and
//! the close mark for a run's state, and the place of every part for a
//! screen's scaling. Nothing here asks Windows anything, so the window's
//! look is pinned without one.

use crate::flow::{Progress, Stage};

/// The name under the mark.
pub const NAME: &str = "OpenHeaders";

/// The window's size, in the units a screen at 100% shows as pixels.
const WIDTH: i32 = 440;
const HEIGHT: i32 = 360;
const MARK_SIZE: i32 = 96;
const MARK_TOP: i32 = 84;
const NAME_TOP: i32 = 196;
const NAME_HEIGHT: i32 = 36;
const LINE_TOP: i32 = 286;
const LINE_HEIGHT: i32 = 22;
const TRACK_TOP: i32 = 320;
const TRACK_HEIGHT: i32 = 4;
/// How far the line and the bar stay from the window's sides.
const INSET: i32 = 36;
const CLOSE_WIDTH: i32 = 46;
const CLOSE_HEIGHT: i32 = 34;
pub const CLOSE_GLYPH: i32 = 10;
pub const NAME_TEXT: i32 = 22;
pub const LINE_TEXT: i32 = 14;

/// The scaling of a screen at 100%.
pub const BASE_DPI: u32 = 96;

/// How many timer ticks the runner takes to cross the track once.
const RUNNER_TICKS: u32 = 48;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Rect {
    pub left: i32,
    pub top: i32,
    pub right: i32,
    pub bottom: i32,
}

impl Rect {
    pub fn width(self) -> i32 {
        self.right - self.left
    }

    pub fn height(self) -> i32 {
        self.bottom - self.top
    }

    pub fn holds(self, x: i32, y: i32) -> bool {
        x >= self.left && x < self.right && y >= self.top && y < self.bottom
    }
}

/// A length for a screen's scaling.
pub fn scaled(length: i32, dpi: u32) -> i32 {
    (length * dpi as i32 + BASE_DPI as i32 / 2) / BASE_DPI as i32
}

/// Where every part of the window lies, in pixels, for a screen's scaling.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Layout {
    pub width: i32,
    pub height: i32,
    pub mark: Rect,
    pub name: Rect,
    pub line: Rect,
    pub track: Rect,
    pub close: Rect,
}

pub fn layout(dpi: u32) -> Layout {
    let at = |length| scaled(length, dpi);
    let width = at(WIDTH);
    let across = |top: i32, height: i32, inset: i32| Rect {
        left: at(inset),
        top: at(top),
        right: width - at(inset),
        bottom: at(top) + at(height),
    };
    let mark_left = (width - at(MARK_SIZE)) / 2;
    Layout {
        width,
        height: at(HEIGHT),
        mark: Rect {
            left: mark_left,
            top: at(MARK_TOP),
            right: mark_left + at(MARK_SIZE),
            bottom: at(MARK_TOP) + at(MARK_SIZE),
        },
        name: across(NAME_TOP, NAME_HEIGHT, 0),
        line: across(LINE_TOP, LINE_HEIGHT, INSET),
        track: across(TRACK_TOP, TRACK_HEIGHT, INSET),
        close: Rect {
            left: width - at(CLOSE_WIDTH),
            top: 0,
            right: width,
            bottom: at(CLOSE_HEIGHT),
        },
    }
}

/// What the bar shows.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Bar {
    /// Filled this far, 0 to 100.
    Filled(u32),
    /// A piece that runs along the track: something is going on that cannot be counted.
    Running,
}

/// What the window shows for a run's state.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Shown {
    pub line: String,
    pub bar: Bar,
    /// Whether the close mark is there to be pressed.
    pub close: bool,
}

/// `cancel_asked`: the person asked the run to end and it has not yet.
pub fn shown(stage: Stage, progress: Progress, cancel_asked: bool) -> Shown {
    // A cancel that came too late is not taken: the run goes on and the window says what it does.
    if cancel_asked && stage.takes_cancel() {
        return Shown {
            line: "Cancelling…".to_string(),
            bar: Bar::Running,
            close: false,
        };
    }
    Shown {
        line: stage.words(progress),
        bar: match (stage, progress.percent()) {
            (Stage::Downloading | Stage::Installing, Some(percent)) => Bar::Filled(percent),
            _ => Bar::Running,
        },
        close: stage.takes_cancel(),
    }
}

/// The filled part of the track. Its ends are round, so the least it is
/// drawn at is as wide as the track is high.
pub fn bar_fill(track: Rect, percent: u32) -> Option<Rect> {
    if percent == 0 {
        return None;
    }
    let width = (i64::from(track.width()) * i64::from(percent.min(100)) / 100) as i32;
    Some(Rect {
        right: track.left + width.max(track.height()).min(track.width()),
        ..track
    })
}

/// The running piece at a timer tick: a quarter of the track, entering at
/// the left end and leaving at the right, then again.
pub fn bar_runner(track: Rect, tick: u32) -> Option<Rect> {
    let piece = track.width() / 4;
    let travel = i64::from(track.width() + piece);
    let offset = (travel * i64::from(tick % RUNNER_TICKS) / i64::from(RUNNER_TICKS)) as i32;
    let left = (track.left - piece + offset).max(track.left);
    let right = (track.left + offset).min(track.right);
    (right - left >= track.height()).then_some(Rect { left, right, ..track })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn inside(part: Rect, layout: Layout) -> bool {
        part.left >= 0
            && part.top >= 0
            && part.right <= layout.width
            && part.bottom <= layout.height
            && part.width() > 0
            && part.height() > 0
    }

    #[test]
    fn every_part_lies_inside_the_window_at_every_scaling() {
        for dpi in [96, 120, 144, 168, 192, 240, 288] {
            let layout = layout(dpi);
            for part in [layout.mark, layout.name, layout.line, layout.track, layout.close] {
                assert!(inside(part, layout), "{dpi}: {part:?}");
            }
            assert!(layout.mark.bottom <= layout.name.top && layout.name.bottom <= layout.line.top);
            assert!(layout.line.bottom <= layout.track.top);
            assert!(layout.close.bottom <= layout.mark.top);
        }
    }

    #[test]
    fn the_mark_is_square_and_centred() {
        for dpi in [96, 144, 192] {
            let layout = layout(dpi);
            assert_eq!(layout.mark.width(), layout.mark.height());
            assert!((layout.mark.left - (layout.width - layout.mark.right)).abs() <= 1);
        }
    }

    #[test]
    fn a_screen_at_one_and_a_half_shows_everything_half_again_as_large() {
        let (plain, large) = (layout(96), layout(144));
        assert_eq!((plain.width, plain.height), (440, 360));
        assert_eq!((large.width, large.height), (660, 540));
        assert_eq!(large.track.height(), 6);
    }

    #[test]
    fn a_download_shows_its_megabytes_and_fills_the_bar() {
        let megabyte = 1024 * 1024;
        let progress = Progress::Bytes {
            have: 98 * megabyte + 5,
            total: 252 * megabyte,
        };
        assert_eq!(
            shown(Stage::Downloading, progress, false),
            Shown {
                line: "Downloading OpenHeaders… 38% (98 of 252 MB)".to_string(),
                bar: Bar::Filled(38),
                close: true,
            }
        );
    }

    #[test]
    fn a_stage_without_a_count_runs_the_bar() {
        for stage in [Stage::Checking, Stage::Verifying, Stage::Opening] {
            assert_eq!(shown(stage, Progress::Unknown, false).bar, Bar::Running);
        }
        assert_eq!(shown(Stage::Downloading, Progress::Unknown, false).bar, Bar::Running);
        assert_eq!(
            shown(Stage::Installing, Progress::Percent(57), false),
            Shown {
                line: "Installing… 57%".to_string(),
                bar: Bar::Filled(57),
                close: false,
            }
        );
    }

    #[test]
    fn the_close_mark_goes_once_windows_has_the_package() {
        assert!(shown(Stage::Verifying, Progress::Unknown, false).close);
        assert!(!shown(Stage::Installing, Progress::Unknown, false).close);
        assert!(!shown(Stage::Opening, Progress::Unknown, false).close);
    }

    #[test]
    fn a_cancel_is_said_until_the_run_ends_and_not_when_it_came_too_late() {
        let asked = shown(Stage::Downloading, Progress::Percent(40), true);
        assert_eq!(
            (asked.line.as_str(), asked.bar, asked.close),
            ("Cancelling…", Bar::Running, false)
        );
        assert_eq!(
            shown(Stage::Installing, Progress::Percent(40), true).line,
            "Installing… 40%"
        );
    }

    #[test]
    fn the_fill_grows_with_the_percentage_and_never_leaves_the_track() {
        let track = layout(96).track;
        assert_eq!(bar_fill(track, 0), None);
        assert_eq!(bar_fill(track, 1).unwrap().width(), track.height());
        assert_eq!(bar_fill(track, 50).unwrap().width(), track.width() / 2);
        assert_eq!(bar_fill(track, 100), Some(track));
        assert_eq!(bar_fill(track, 250), Some(track));
    }

    #[test]
    fn the_runner_stays_on_the_track_and_comes_round_again() {
        let track = layout(96).track;
        let mut widest = 0;
        for tick in 0..RUNNER_TICKS {
            if let Some(piece) = bar_runner(track, tick) {
                assert!(
                    piece.left >= track.left && piece.right <= track.right,
                    "{tick}: {piece:?}"
                );
                assert_eq!((piece.top, piece.bottom), (track.top, track.bottom));
                widest = widest.max(piece.width());
            }
        }
        assert_eq!(widest, track.width() / 4);
        assert_eq!(bar_runner(track, 5), bar_runner(track, 5 + RUNNER_TICKS));
    }
}
