//! What the installer's window shows, and where: the line and the bar
//! for a run's state, and the place of every part for a
//! screen's scaling. Nothing here asks Windows anything, so the window's
//! look is pinned without one.

use crate::flow::{Progress, Stage};

/// The name under the mark, "Open Headers", as the product writes it: in its wordmark face, which
/// is drawn on a grid of eight dots a letter. The name is kept as those dots, a row of text for a
/// row of dots, and drawn as squares — sharp at every scaling, and no font is carried.
const WORDMARK: [&str; 8] = [
    ".#####..................................##...##......................##.........................",
    "##...##.................................##...##......................##.........................",
    "##...##.######...#####..######..........##...##..#####...#####...######..#####...##.###..#####..",
    "##...##.##...##.##...##.##...##.........#######.##...##......##.##...##.##...##..###....##......",
    "##...##.##...##.#######.##...##.........##...##.#######..######.##...##.#######..##......#####..",
    "##...##.######..##......##...##.........##...##.##......##...##.##...##.##.......##..........##.",
    ".#####..##.......#####..##...##.........##...##..#####...######..######..#####...##.....######..",
    "........##......................................................................................",
];
/// The side of one dot of the name.
const WORDMARK_DOT: i32 = 3;

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
    }
}

/// The name's dots as rectangles, one for each unbroken run of dots in a row, centred in `place`.
/// A dot is a whole number of pixels a side.
pub fn wordmark(place: Rect, dpi: u32) -> Vec<Rect> {
    let dot = scaled(WORDMARK_DOT, dpi).max(1);
    let used = |row: &&str| row.rfind('#').map_or(0, |column| column + 1);
    let columns = WORDMARK.iter().map(used).max().unwrap_or(0) as i32;
    let left = place.left + (place.width() - columns * dot) / 2;
    let top = place.top + (place.height() - WORDMARK.len() as i32 * dot) / 2;
    let mut runs = Vec::new();
    for (row, dots) in WORDMARK.iter().enumerate() {
        let top = top + row as i32 * dot;
        let mut start = None;
        // One column past the end closes a run that reaches it.
        for (column, mark) in dots.bytes().chain(*b".").enumerate() {
            match (mark == b'#', start) {
                (true, None) => start = Some(column),
                (false, Some(from)) => {
                    runs.push(Rect {
                        left: left + from as i32 * dot,
                        top,
                        right: left + column as i32 * dot,
                        bottom: top + dot,
                    });
                    start = None;
                }
                _ => {}
            }
        }
    }
    runs
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
    /// Whether a cancel is taken now: Esc, or the window closed from the taskbar.
    pub takes_cancel: bool,
}

/// `cancel_asked`: the person asked the run to end and it has not yet.
pub fn shown(stage: Stage, progress: Progress, cancel_asked: bool) -> Shown {
    // A cancel that came too late is not taken: the run goes on and the window says what it does.
    if cancel_asked && stage.takes_cancel() {
        return Shown {
            line: "Cancelling…".to_string(),
            bar: Bar::Running,
            takes_cancel: false,
        };
    }
    Shown {
        line: stage.words(progress),
        bar: match (stage, progress.percent()) {
            (Stage::Downloading | Stage::Installing, Some(percent)) => Bar::Filled(percent),
            _ => Bar::Running,
        },
        takes_cancel: stage.takes_cancel(),
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
            for part in [layout.mark, layout.name, layout.line, layout.track] {
                assert!(inside(part, layout), "{dpi}: {part:?}");
            }
            assert!(layout.mark.bottom <= layout.name.top && layout.name.bottom <= layout.line.top);
            assert!(layout.line.bottom <= layout.track.top);
        }
    }

    #[test]
    fn the_name_is_twelve_letters_of_eight_dots_and_lies_in_its_place() {
        assert!(WORDMARK.iter().all(|row| row.len() == 12 * 8));
        let dots: usize = WORDMARK.iter().map(|row| row.matches('#').count()).sum();
        for dpi in [96, 120, 144, 168, 192, 240, 288] {
            let place = layout(dpi).name;
            let runs = wordmark(place, dpi);
            let dot = runs[0].height();
            assert!(dot >= 2 && runs.iter().all(|run| run.height() == dot && run.width() % dot == 0));
            let drawn: i32 = runs.iter().map(|run| run.width() / dot).sum();
            assert_eq!(drawn as usize, dots, "{dpi}");
            let (left, right) = (
                runs.iter().map(|run| run.left).min().unwrap(),
                runs.iter().map(|run| run.right).max().unwrap(),
            );
            assert!(left >= place.left && right <= place.right, "{dpi}");
            assert!(
                runs.iter()
                    .all(|run| run.top >= place.top && run.bottom <= place.bottom)
            );
            assert!(((left - place.left) - (place.right - right)).abs() <= 1, "{dpi}");
        }
    }

    #[test]
    fn the_name_leaves_a_letters_width_between_its_two_words() {
        // "Open" is four letters, the space the fifth: nothing is drawn in its eight columns.
        assert!(WORDMARK.iter().all(|row| !row[4 * 8..5 * 8].contains('#')));
        assert!(WORDMARK.iter().any(|row| row[5 * 8..6 * 8].contains('#')));
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
                takes_cancel: true,
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
                takes_cancel: false,
            }
        );
    }

    #[test]
    fn no_cancel_is_taken_once_windows_has_the_package() {
        assert!(shown(Stage::Verifying, Progress::Unknown, false).takes_cancel);
        assert!(!shown(Stage::Installing, Progress::Unknown, false).takes_cancel);
        assert!(!shown(Stage::Opening, Progress::Unknown, false).takes_cancel);
    }

    #[test]
    fn a_cancel_is_said_until_the_run_ends_and_not_when_it_came_too_late() {
        let asked = shown(Stage::Downloading, Progress::Percent(40), true);
        assert_eq!(
            (asked.line.as_str(), asked.bar, asked.takes_cancel),
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
