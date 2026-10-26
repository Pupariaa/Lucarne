#ifndef LUCARNE_HD44780_H
#define LUCARNE_HD44780_H

#include <Arduino.h>
#include "../core/LucarneGfx.h"
#include "../core/LucarneTypes.h"

namespace lucarne {

class HD44780 : public Gfx {
  public:
    static const uint8_t MAX_COLS = 40;
    static const uint8_t MAX_ROWS = 4;

    HD44780();

    bool begin(const MatrixDisplayPins &pins, const MatrixDisplayOptions &options = MatrixDisplayOptions());
    bool begin(const MatrixDisplayPins &pins, const MatrixDisplayOptions &options, const DisplayOptions &display);
    void backlight(bool on);
    void clear();
    uint8_t cols() const { return _opt.cols; }
    uint8_t rows() const { return _opt.rows; }
    void setCell(uint8_t col, uint8_t row, uint8_t glyph);
    uint8_t cellAt(uint8_t col, uint8_t row) const;

    void writePixel(int16_t x, int16_t y, uint16_t color) override;
    void writeFillRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color) override;
    void writeFastHLine(int16_t x, int16_t y, int16_t w, uint16_t color) override;
    void writeFastVLine(int16_t x, int16_t y, int16_t h, uint16_t color) override;

    bool isCharacterGrid() const override { return true; }
    int16_t gridCellWidth() const override { return _opt.charWidth; }
    int16_t gridCellHeight() const override { return _opt.charHeight; }
    void drawGridText(int16_t x, int16_t y, int16_t w, int16_t h, const char *text, uint8_t align,
                      bool inverted) override;
    void drawGridBar(int16_t x, int16_t y, int16_t w, int16_t h, float ratio) override;

    BufferMode bufferMode() const override { return BufferMode::None; }
    void presentFull() override;
    void presentDirty() override;
    void flushArea(int16_t x, int16_t y, int16_t w, int16_t h) override;
    bool flushRect(int16_t x, int16_t y, int16_t w, int16_t h) override;

  private:
    void write4(uint8_t nibble);
    void send(uint8_t value, bool data);
    void command(uint8_t c);
    void pulseEnable();
    void setCursorCell(uint8_t col, uint8_t row);
    void loadBarGlyphs();
    void flushCells(uint8_t c0, uint8_t r0, uint8_t c1, uint8_t r1);
    bool cellVisible(uint8_t col, uint8_t row) const;
    bool cellSpan(int16_t x, int16_t y, int16_t w, int16_t h, uint8_t &row, uint8_t &col0, uint8_t &ncols) const;
    static uint8_t mapCodepoint(uint16_t cp);

    MatrixDisplayPins _pins;
    MatrixDisplayOptions _opt;
    uint8_t _cells[MAX_ROWS][MAX_COLS];
    uint8_t _shown[MAX_ROWS][MAX_COLS];
    int16_t _cursorCol;
    int16_t _cursorRow;
    bool _ready;
    bool _blActiveLow;
};

}

#endif
