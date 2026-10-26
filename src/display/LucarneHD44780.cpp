#include "LucarneHD44780.h"
#include "../core/LucarneUtf8.h"
#include <string.h>

namespace lucarne {

static const uint8_t kGlyphBlank = 0x20;
static const uint8_t kGlyphFull = 0xFF;
static const uint8_t kGlyphMarker = 0x7E;

HD44780::HD44780() : Gfx(0, 0), _cursorCol(-1), _cursorRow(-1), _ready(false), _blActiveLow(false) {
    memset(_cells, kGlyphBlank, sizeof(_cells));
    memset(_shown, kGlyphBlank, sizeof(_shown));
}

bool HD44780::begin(const MatrixDisplayPins &pins, const MatrixDisplayOptions &options) {
    _pins = pins;
    _opt = options;
    if (_opt.cols < 1) _opt.cols = 16;
    if (_opt.cols > MAX_COLS) _opt.cols = MAX_COLS;
    if (_opt.rows < 1) _opt.rows = 2;
    if (_opt.rows > MAX_ROWS) _opt.rows = MAX_ROWS;
    if (_opt.charWidth < 1) _opt.charWidth = 8;
    if (_opt.charHeight < 1) _opt.charHeight = 8;
    WIDTH = (int16_t)(_opt.cols * _opt.charWidth);
    HEIGHT = (int16_t)(_opt.rows * _opt.charHeight);
    _width = WIDTH;
    _height = HEIGHT;

    if (_pins.rs < 0 || _pins.en < 0 || _pins.d4 < 0 || _pins.d5 < 0 || _pins.d6 < 0 || _pins.d7 < 0) {
        return false;
    }
    pinMode(_pins.rs, OUTPUT);
    pinMode(_pins.en, OUTPUT);
    pinMode(_pins.d4, OUTPUT);
    pinMode(_pins.d5, OUTPUT);
    pinMode(_pins.d6, OUTPUT);
    pinMode(_pins.d7, OUTPUT);
    if (_pins.rw >= 0) {
        pinMode(_pins.rw, OUTPUT);
        digitalWrite(_pins.rw, LOW);
    }
    if (_pins.bl >= 0) {
        pinMode(_pins.bl, OUTPUT);
        backlight(true);
    }
    digitalWrite(_pins.rs, LOW);
    digitalWrite(_pins.en, LOW);
    delay(50);

    write4(0x03);
    delayMicroseconds(4500);
    write4(0x03);
    delayMicroseconds(4500);
    write4(0x03);
    delayMicroseconds(150);
    write4(0x02);

    command((uint8_t)(0x20 | (_opt.rows > 1 ? 0x08 : 0x00)));
    command(0x0C);
    command(0x06);
    loadBarGlyphs();
    clear();
    _ready = true;
    return true;
}

bool HD44780::begin(const MatrixDisplayPins &pins, const MatrixDisplayOptions &options,
                    const DisplayOptions &display) {
    _blActiveLow = display.blActiveLow;
    if (!begin(pins, options)) return false;
    backlight(true);
    return true;
}

void HD44780::backlight(bool on) {
    if (_pins.bl >= 0) digitalWrite(_pins.bl, (on != _blActiveLow) ? HIGH : LOW);
}

void HD44780::clear() {
    command(0x01);
    delayMicroseconds(2000);
    memset(_cells, kGlyphBlank, sizeof(_cells));
    memset(_shown, kGlyphBlank, sizeof(_shown));
    _cursorCol = 0;
    _cursorRow = 0;
}

void HD44780::write4(uint8_t nibble) {
    digitalWrite(_pins.d4, (nibble & 0x01) ? HIGH : LOW);
    digitalWrite(_pins.d5, (nibble & 0x02) ? HIGH : LOW);
    digitalWrite(_pins.d6, (nibble & 0x04) ? HIGH : LOW);
    digitalWrite(_pins.d7, (nibble & 0x08) ? HIGH : LOW);
    pulseEnable();
}

void HD44780::pulseEnable() {
    digitalWrite(_pins.en, LOW);
    delayMicroseconds(1);
    digitalWrite(_pins.en, HIGH);
    delayMicroseconds(1);
    digitalWrite(_pins.en, LOW);
    delayMicroseconds(50);
}

void HD44780::send(uint8_t value, bool data) {
    digitalWrite(_pins.rs, data ? HIGH : LOW);
    write4((uint8_t)(value >> 4));
    write4((uint8_t)(value & 0x0F));
}

void HD44780::command(uint8_t c) { send(c, false); }

void HD44780::setCursorCell(uint8_t col, uint8_t row) {
    static const uint8_t base[] = {0x00, 0x40};
    uint8_t addr = (uint8_t)(base[row & 1] + (row >= 2 ? _opt.cols : 0) + col);
    command((uint8_t)(0x80 | addr));
    _cursorCol = col;
    _cursorRow = row;
}

void HD44780::loadBarGlyphs() {
    for (uint8_t k = 1; k <= 4; k++) {
        command((uint8_t)(0x40 | (k << 3)));
        uint8_t bits = (uint8_t)(0x1F & ~(0x1F >> k));
        for (uint8_t line = 0; line < 8; line++) send(bits, true);
    }
    _cursorCol = -1;
    _cursorRow = -1;
}

uint8_t HD44780::mapCodepoint(uint16_t cp) {
    if (cp == 0x5C || cp == 0x7E) return '-';
    if (cp >= 0x20 && cp < 0x7F) return (uint8_t)cp;
    if (cp == 0xB0) return 0xDF;
    if (cp == 0xB5) return 0xE4;
    if (cp == 0x2192) return 0x7E;
    if (cp == 0x2190) return 0x7F;
    if (cp >= 0xC0 && cp <= 0xC5) return 'A';
    if (cp >= 0xE0 && cp <= 0xE5) return 'a';
    if (cp == 0xC7) return 'C';
    if (cp == 0xE7) return 'c';
    if (cp >= 0xC8 && cp <= 0xCB) return 'E';
    if (cp >= 0xE8 && cp <= 0xEB) return 'e';
    if (cp >= 0xCC && cp <= 0xCF) return 'I';
    if (cp >= 0xEC && cp <= 0xEF) return 'i';
    if (cp >= 0xD2 && cp <= 0xD6) return 'O';
    if (cp >= 0xF2 && cp <= 0xF6) return 'o';
    if (cp >= 0xD9 && cp <= 0xDC) return 'U';
    if (cp >= 0xF9 && cp <= 0xFC) return 'u';
    return '?';
}

void HD44780::setCell(uint8_t col, uint8_t row, uint8_t glyph) {
    if (col >= _opt.cols || row >= _opt.rows) return;
    _cells[row][col] = glyph;
}

uint8_t HD44780::cellAt(uint8_t col, uint8_t row) const {
    if (col >= _opt.cols || row >= _opt.rows) return kGlyphBlank;
    return _cells[row][col];
}

bool HD44780::cellVisible(uint8_t col, uint8_t row) const {
    int16_t cx = (int16_t)(col * _opt.charWidth + _opt.charWidth / 2);
    int16_t cy = (int16_t)(row * _opt.charHeight + _opt.charHeight / 2);
    return pointInClip(cx, cy);
}

bool HD44780::cellSpan(int16_t x, int16_t y, int16_t w, int16_t h, uint8_t &row, uint8_t &col0,
                       uint8_t &ncols) const {
    int16_t cw = _opt.charWidth;
    int16_t ch = _opt.charHeight;
    int16_t midY = (int16_t)(y + (h > 0 ? h : ch) / 2);
    if (midY < 0 || midY >= _height) return false;
    row = (uint8_t)(midY / ch);
    if (row >= _opt.rows) return false;
    int16_t c0 = x >= 0 ? (int16_t)((x + cw / 2) / cw) : 0;
    if (c0 >= _opt.cols) return false;
    int16_t span = w > 0 ? (int16_t)((w + cw / 2) / cw) : (int16_t)(_opt.cols - c0);
    if (span < 1) span = 1;
    if (c0 + span > _opt.cols) span = (int16_t)(_opt.cols - c0);
    col0 = (uint8_t)c0;
    ncols = (uint8_t)span;
    return true;
}

void HD44780::drawGridText(int16_t x, int16_t y, int16_t w, int16_t h, const char *text, uint8_t align,
                           bool inverted) {
    uint8_t row = 0;
    uint8_t col0 = 0;
    uint8_t ncols = 0;
    if (!cellSpan(x, y, w, h, row, col0, ncols)) return;
    uint8_t glyphs[MAX_COLS];
    uint8_t len = 0;
    if (inverted && len < ncols) glyphs[len++] = kGlyphMarker;
    const char *p = text ? text : "";
    while (*p && len < ncols) {
        if (*p == '\n' || *p == '\r') break;
        uint16_t cp = 0;
        const char *next = p;
        if (!utf8NextCodepoint(next, cp)) {
            p = next;
            continue;
        }
        p = next;
        glyphs[len++] = mapCodepoint(cp);
    }
    uint8_t start = 0;
    if (w > 0 && len < ncols) {
        if (align == 1) start = (uint8_t)((ncols - len) / 2);
        else if (align == 2) start = (uint8_t)(ncols - len);
    }
    for (uint8_t i = 0; i < len; i++) {
        uint8_t col = (uint8_t)(col0 + start + i);
        if (col >= _opt.cols) break;
        if (cellVisible(col, row)) _cells[row][col] = glyphs[i];
    }
}

void HD44780::drawGridBar(int16_t x, int16_t y, int16_t w, int16_t h, float ratio) {
    uint8_t row = 0;
    uint8_t col0 = 0;
    uint8_t ncols = 0;
    if (!cellSpan(x, y, w, h, row, col0, ncols)) return;
    if (ratio < 0.0f) ratio = 0.0f;
    if (ratio > 1.0f) ratio = 1.0f;
    int16_t total = (int16_t)(ratio * (float)ncols * 5.0f + 0.5f);
    for (uint8_t i = 0; i < ncols; i++) {
        int16_t fill = (int16_t)(total - (int16_t)i * 5);
        if (fill < 0) fill = 0;
        if (fill > 5) fill = 5;
        uint8_t glyph = fill == 0 ? kGlyphBlank : (fill == 5 ? kGlyphFull : (uint8_t)fill);
        uint8_t col = (uint8_t)(col0 + i);
        if (cellVisible(col, row)) _cells[row][col] = glyph;
    }
}

void HD44780::writePixel(int16_t x, int16_t y, uint16_t color) {
    (void)x;
    (void)y;
    (void)color;
}

void HD44780::writeFillRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color) {
    (void)color;
    if (w < _opt.charWidth / 2 || h < _opt.charHeight / 2) return;
    Rect r = Rect(x, y, w, h).intersect(clipRect());
    if (r.empty()) return;
    for (uint8_t row = 0; row < _opt.rows; row++) {
        int16_t cy = (int16_t)(row * _opt.charHeight + _opt.charHeight / 2);
        if (cy < r.y || cy >= r.bottom()) continue;
        for (uint8_t col = 0; col < _opt.cols; col++) {
            int16_t cx = (int16_t)(col * _opt.charWidth + _opt.charWidth / 2);
            if (cx < r.x || cx >= r.right()) continue;
            _cells[row][col] = kGlyphBlank;
        }
    }
}

void HD44780::writeFastHLine(int16_t x, int16_t y, int16_t w, uint16_t color) {
    (void)x;
    (void)y;
    (void)w;
    (void)color;
}

void HD44780::writeFastVLine(int16_t x, int16_t y, int16_t h, uint16_t color) {
    (void)x;
    (void)y;
    (void)h;
    (void)color;
}

void HD44780::flushCells(uint8_t c0, uint8_t r0, uint8_t c1, uint8_t r1) {
    if (!_ready) return;
    for (uint8_t row = r0; row <= r1 && row < _opt.rows; row++) {
        for (uint8_t col = c0; col <= c1 && col < _opt.cols; col++) {
            uint8_t g = _cells[row][col];
            if (_shown[row][col] == g) continue;
            if (_cursorRow != row || _cursorCol != col) setCursorCell(col, row);
            send(g, true);
            _shown[row][col] = g;
            _cursorCol = (int16_t)(col + 1);
        }
    }
}

bool HD44780::flushRect(int16_t x, int16_t y, int16_t w, int16_t h) {
    Rect r = Rect(x, y, w, h).intersect(Rect(0, 0, _width, _height));
    if (r.empty()) return false;
    uint8_t c0 = (uint8_t)(r.x / _opt.charWidth);
    uint8_t r0 = (uint8_t)(r.y / _opt.charHeight);
    uint8_t c1 = (uint8_t)((r.right() - 1) / _opt.charWidth);
    uint8_t r1 = (uint8_t)((r.bottom() - 1) / _opt.charHeight);
    flushCells(c0, r0, c1, r1);
    return true;
}

void HD44780::flushArea(int16_t x, int16_t y, int16_t w, int16_t h) { flushRect(x, y, w, h); }

void HD44780::presentFull() {
    if (!_ready) return;
    memset(_shown, 0, sizeof(_shown));
    flushCells(0, 0, (uint8_t)(_opt.cols - 1), (uint8_t)(_opt.rows - 1));
}

void HD44780::presentDirty() { flushCells(0, 0, (uint8_t)(_opt.cols - 1), (uint8_t)(_opt.rows - 1)); }

}
