//! How the installer's window is drawn: its colours, read from the PC's
//! own settings, and one whole picture of it for a state — the ground,
//! the mark, the name, the line and the bar — drawn off
//! screen and put on the window in one piece.

use core::ffi::c_void;
use std::ptr::null_mut;

use windows::Win32::Foundation::{COLORREF, ERROR_SUCCESS, RECT};
use windows::Win32::Graphics::Gdi::{
    BitBlt, CLEARTYPE_QUALITY, CLIP_DEFAULT_PRECIS, COLOR_GRAYTEXT, COLOR_HIGHLIGHT, COLOR_WINDOW, COLOR_WINDOWTEXT,
    CreateCompatibleBitmap, CreateCompatibleDC, CreateFontW, CreateSolidBrush, DEFAULT_CHARSET, DT_CENTER,
    DT_END_ELLIPSIS, DT_NOPREFIX, DT_SINGLELINE, DT_VCENTER, DeleteDC, DeleteObject, DrawTextW, FW_NORMAL, FillRect,
    FrameRect, GetSysColor, HDC, HFONT, HGDIOBJ, OUT_DEFAULT_PRECIS, SRCCOPY, SYS_COLOR_INDEX, SelectObject, SetBkMode,
    SetTextColor, TRANSPARENT,
};
use windows::Win32::Graphics::GdiPlus::{
    GdipCreateBitmapFromScan0, GdipCreateBitmapFromStream, GdipCreateFromHDC, GdipCreateSolidFill, GdipDeleteBrush,
    GdipDeleteGraphics, GdipDisposeImage, GdipDrawImageRectI, GdipFillEllipse, GdipFillRectangle,
    GdipGetImageGraphicsContext, GdipSetInterpolationMode, GdipSetPixelOffsetMode, GdipSetSmoothingMode,
    GdiplusShutdown, GdiplusStartup, GdiplusStartupInput, GpBitmap, GpBrush, GpGraphics, GpImage, GpSolidFill,
    InterpolationModeHighQualityBicubic, PixelOffsetModeHalf, SmoothingModeAntiAlias,
};
use windows::Win32::System::Registry::{HKEY_CURRENT_USER, RRF_RT_REG_DWORD, RegGetValueW};
use windows::Win32::UI::Accessibility::{HCF_HIGHCONTRASTON, HIGHCONTRASTW};
use windows::Win32::UI::Shell::SHCreateMemStream;
use windows::Win32::UI::WindowsAndMessaging::{
    SPI_GETHIGHCONTRAST, SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS, SystemParametersInfoW,
};
use windows::core::w;

use crate::view::{self, Bar, Layout, Rect, Shown};

/// The app's mark: the desktop's own icon picture, read where it lives.
const MARK: &[u8] = include_bytes!("../../../../apps/desktop/build/icon.png");

/// The picture library's number for a picture of four bytes a dot, the colours already weighed
/// by how solid the dot is — the form it draws fastest. The bindings carry no name for it.
const SOLID_WEIGHED_DOTS: i32 = 0x000E_200B;

/// A colour as Windows keeps one: blue, green, red from the top byte down.
const fn rgb(red: u32, green: u32, blue: u32) -> u32 {
    (blue << 16) | (green << 8) | red
}

/// The same colour, opaque, as the picture library takes one.
fn argb(color: u32) -> u32 {
    0xFF00_0000 | ((color & 0xFF) << 16) | (color & 0xFF00) | ((color >> 16) & 0xFF)
}

#[derive(Debug, Clone, Copy)]
pub struct Palette {
    ground: u32,
    /// The name.
    text: u32,
    /// The line.
    quiet: u32,
    track: u32,
    fill: u32,
}

const LIGHT: Palette = Palette {
    ground: rgb(0xDC, 0xDC, 0xDC),
    text: rgb(0x1A, 0x1A, 0x1A),
    quiet: rgb(0x4E, 0x4E, 0x4E),
    track: rgb(0xC2, 0xC2, 0xC2),
    fill: rgb(0x3F, 0x74, 0xE0),
};

const DARK: Palette = Palette {
    ground: rgb(0x20, 0x20, 0x20),
    text: rgb(0xF2, 0xF2, 0xF2),
    quiet: rgb(0xAB, 0xAB, 0xAB),
    track: rgb(0x3A, 0x3A, 0x3A),
    fill: rgb(0x58, 0x90, 0xFF),
};

/// Whether the person chose dark for apps. A PC that does not say is light.
fn apps_are_dark() -> bool {
    let mut light = 1u32;
    let mut size = size_of::<u32>() as u32;
    let read = unsafe {
        RegGetValueW(
            HKEY_CURRENT_USER,
            w!("Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize"),
            w!("AppsUseLightTheme"),
            RRF_RT_REG_DWORD,
            None,
            Some((&raw mut light).cast::<c_void>()),
            Some(&raw mut size),
        )
    };
    read == ERROR_SUCCESS && light == 0
}

fn high_contrast_is_on() -> bool {
    let mut contrast = HIGHCONTRASTW {
        cbSize: size_of::<HIGHCONTRASTW>() as u32,
        ..Default::default()
    };
    let read = unsafe {
        SystemParametersInfoW(
            SPI_GETHIGHCONTRAST,
            contrast.cbSize,
            Some((&raw mut contrast).cast::<c_void>()),
            SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS(0),
        )
    };
    read.is_ok() && contrast.dwFlags.contains(HCF_HIGHCONTRASTON)
}

/// The window's colours on this PC, now: the person's contrast colours
/// where they asked for contrast, else the light or the dark set.
pub fn palette() -> Palette {
    if high_contrast_is_on() {
        let system = |index: SYS_COLOR_INDEX| unsafe { GetSysColor(index) };
        return Palette {
            ground: system(COLOR_WINDOW),
            text: system(COLOR_WINDOWTEXT),
            quiet: system(COLOR_WINDOWTEXT),
            track: system(COLOR_GRAYTEXT),
            fill: system(COLOR_HIGHLIGHT),
        };
    }
    if apps_are_dark() { DARK } else { LIGHT }
}

/// What a picture of the window takes beside the run's state.
#[derive(Clone, Copy)]
pub struct Look {
    pub palette: Palette,
    /// The timer tick the running piece of the bar is drawn at.
    pub tick: u32,
    /// Windows gives the window no edge of its own: one is drawn.
    pub framed: bool,
}

fn font(height: i32, weight: i32) -> HFONT {
    unsafe {
        CreateFontW(
            -height,
            0,
            0,
            0,
            weight,
            0,
            0,
            0,
            DEFAULT_CHARSET,
            OUT_DEFAULT_PRECIS,
            CLIP_DEFAULT_PRECIS,
            CLEARTYPE_QUALITY,
            0,
            w!("Segoe UI"),
        )
    }
}

fn to_rect(rect: Rect) -> RECT {
    RECT {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
    }
}

/// The picture library's brush of one colour, deleted when it goes.
struct Brush(*mut GpSolidFill);

impl Brush {
    fn new(color: u32) -> Brush {
        let mut brush = null_mut();
        unsafe { GdipCreateSolidFill(argb(color), &raw mut brush) };
        Brush(brush)
    }

    fn raw(&self) -> *mut GpBrush {
        self.0.cast()
    }
}

impl Drop for Brush {
    fn drop(&mut self) {
        if !self.0.is_null() {
            unsafe { GdipDeleteBrush(self.raw()) };
        }
    }
}

/// A bar with round ends.
fn pill(graphics: *mut GpGraphics, rect: Rect, color: u32) {
    let brush = Brush::new(color);
    let (left, top) = (rect.left as f32, rect.top as f32);
    let (width, height) = (rect.width() as f32, rect.height() as f32);
    unsafe {
        GdipFillEllipse(graphics, brush.raw(), left, top, height, height);
        GdipFillEllipse(graphics, brush.raw(), left + width - height, top, height, height);
        GdipFillRectangle(graphics, brush.raw(), left + height / 2.0, top, width - height, height);
    }
}

/// What draws the window, kept for as long as the window lives: the
/// picture library, the mark as it was read, and for the screen's
/// scaling the mark at its size and the line's font.
pub struct Painter {
    library: usize,
    source: *mut GpImage,
    /// The mark at the size the window shows it, so that drawing the window scales nothing.
    mark: *mut GpImage,
    dpi: u32,
    line_font: HFONT,
}

impl Painter {
    pub fn new() -> Painter {
        let mut library = 0usize;
        let input = GdiplusStartupInput {
            GdiplusVersion: 1,
            ..Default::default()
        };
        unsafe { GdiplusStartup(&raw mut library, &raw const input, null_mut()) };
        // A mark that cannot be read leaves its place empty; the window still says what it does.
        let mut bitmap: *mut GpBitmap = null_mut();
        if let Some(stream) = unsafe { SHCreateMemStream(Some(MARK)) } {
            unsafe { GdipCreateBitmapFromStream(&stream, &raw mut bitmap) };
        }
        Painter {
            library,
            source: bitmap.cast(),
            mark: null_mut(),
            dpi: 0,
            line_font: HFONT::default(),
        }
    }

    fn drop_font(&mut self) {
        if !self.line_font.is_invalid() {
            unsafe {
                let _ = DeleteObject(HGDIOBJ(self.line_font.0));
            }
        }
    }

    fn drop_mark(&mut self) {
        if !self.mark.is_null() {
            unsafe { GdipDisposeImage(self.mark) };
            self.mark = null_mut();
        }
    }

    /// The mark as read, drawn once at `size` dots a side.
    fn mark_at(&self, size: i32) -> *mut GpImage {
        if self.source.is_null() {
            return null_mut();
        }
        let mut bitmap: *mut GpBitmap = null_mut();
        unsafe { GdipCreateBitmapFromScan0(size, size, 0, SOLID_WEIGHED_DOTS, None, &raw mut bitmap) };
        let mut graphics: *mut GpGraphics = null_mut();
        if !bitmap.is_null() {
            unsafe { GdipGetImageGraphicsContext(bitmap.cast(), &raw mut graphics) };
        }
        if !graphics.is_null() {
            unsafe {
                GdipSetInterpolationMode(graphics, InterpolationModeHighQualityBicubic);
                GdipSetPixelOffsetMode(graphics, PixelOffsetModeHalf);
                GdipDrawImageRectI(graphics, self.source, 0, 0, size, size);
                GdipDeleteGraphics(graphics);
            }
        }
        bitmap.cast()
    }

    /// The mark and the fonts for a screen's scaling.
    pub fn rescale(&mut self, dpi: u32) {
        if dpi == self.dpi {
            return;
        }
        self.drop_font();
        self.drop_mark();
        self.dpi = dpi;
        self.mark = self.mark_at(view::layout(dpi).mark.width());
        self.line_font = font(view::scaled(view::LINE_TEXT, dpi), FW_NORMAL.0 as i32);
    }

    fn shapes(&self, canvas: HDC, layout: &Layout, shown: &Shown, look: Look) {
        let mut graphics: *mut GpGraphics = null_mut();
        unsafe { GdipCreateFromHDC(canvas, &raw mut graphics) };
        if graphics.is_null() {
            return;
        }
        let palette = look.palette;
        unsafe {
            GdipSetSmoothingMode(graphics, SmoothingModeAntiAlias);
            GdipSetPixelOffsetMode(graphics, PixelOffsetModeHalf);
        }
        if !self.mark.is_null() {
            let mark = layout.mark;
            unsafe { GdipDrawImageRectI(graphics, self.mark, mark.left, mark.top, mark.width(), mark.height()) };
        }

        pill(graphics, layout.track, palette.track);
        let moving = match shown.bar {
            Bar::Filled(percent) => view::bar_fill(layout.track, percent),
            Bar::Running => view::bar_runner(layout.track, look.tick),
        };
        if let Some(part) = moving {
            pill(graphics, part, palette.fill);
        }

        unsafe { GdipDeleteGraphics(graphics) };
    }

    /// The name, dot by dot, and the line under it.
    fn words(&self, canvas: HDC, layout: &Layout, shown: &Shown, palette: Palette) {
        let centred = DT_CENTER | DT_VCENTER | DT_SINGLELINE | DT_NOPREFIX | DT_END_ELLIPSIS;
        let mut line: Vec<u16> = shown.line.encode_utf16().collect();
        let mut place = to_rect(layout.line);
        unsafe {
            let ink = CreateSolidBrush(COLORREF(palette.text));
            for run in view::wordmark(layout.name, self.dpi) {
                let dots = to_rect(run);
                FillRect(canvas, &raw const dots, ink);
            }
            let _ = DeleteObject(HGDIOBJ(ink.0));

            SetBkMode(canvas, TRANSPARENT);
            let before = SelectObject(canvas, HGDIOBJ(self.line_font.0));
            SetTextColor(canvas, COLORREF(palette.quiet));
            DrawTextW(canvas, &mut line, &raw mut place, centred);
            SelectObject(canvas, before);
        }
    }

    /// Draws the whole window for a state onto `target`.
    pub fn draw(&self, target: HDC, layout: &Layout, shown: &Shown, look: Look) {
        let whole = RECT {
            left: 0,
            top: 0,
            right: layout.width,
            bottom: layout.height,
        };
        unsafe {
            let canvas = CreateCompatibleDC(Some(target));
            let picture = CreateCompatibleBitmap(target, layout.width, layout.height);
            let before = SelectObject(canvas, HGDIOBJ(picture.0));

            let ground = CreateSolidBrush(COLORREF(look.palette.ground));
            FillRect(canvas, &raw const whole, ground);
            let _ = DeleteObject(HGDIOBJ(ground.0));
            if look.framed {
                let edge = CreateSolidBrush(COLORREF(look.palette.track));
                FrameRect(canvas, &raw const whole, edge);
                let _ = DeleteObject(HGDIOBJ(edge.0));
            }
            self.shapes(canvas, layout, shown, look);
            self.words(canvas, layout, shown, look.palette);

            let _ = BitBlt(target, 0, 0, layout.width, layout.height, Some(canvas), 0, 0, SRCCOPY);
            SelectObject(canvas, before);
            let _ = DeleteObject(HGDIOBJ(picture.0));
            let _ = DeleteDC(canvas);
        }
    }
}

impl Drop for Painter {
    fn drop(&mut self) {
        self.drop_font();
        self.drop_mark();
        unsafe {
            if !self.source.is_null() {
                GdipDisposeImage(self.source);
            }
            if self.library != 0 {
                GdiplusShutdown(self.library);
            }
        }
    }
}
