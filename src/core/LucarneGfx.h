#ifndef LUCARNE_GFX_H
#define LUCARNE_GFX_H

#include <stddef.h>
#include <stdint.h>
#include "LucarneColor.h"
#include "LucarneFont.h"

namespace lucarne {

class Gfx {
  public:
    Gfx(int16_t w, int16_t h);
    virtual ~Gfx();

    virtual void writePixel(int16_t x, int16_t y, uint16_t color) = 0;
    virtual void writeFillRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color);
    virtual void writeFastHLine(int16_t x, int16_t y, int16_t w, uint16_t color);
    virtual void writeFastVLine(int16_t x, int16_t y, int16_t h, uint16_t color);
    virtual void startWrite();
    virtual void endWrite();

    void drawPixel(int16_t x, int16_t y, uint16_t color);
    void drawFastHLine(int16_t x, int16_t y, int16_t w, uint16_t color);
    void drawFastVLine(int16_t x, int16_t y, int16_t h, uint16_t color);
    void fillRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color);
    void fillScreen(uint16_t color);
    void drawLine(int16_t x0, int16_t y0, int16_t x1, int16_t y1, uint16_t color);
    void drawRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color);
    void drawCircle(int16_t x0, int16_t y0, int16_t r, uint16_t color);
    void drawCircleHelper(int16_t x0, int16_t y0, int16_t r, uint8_t corner, uint16_t color);
    void fillCircle(int16_t x0, int16_t y0, int16_t r, uint16_t color);
    void fillCircleHelper(int16_t x0, int16_t y0, int16_t r, uint8_t corner, int16_t delta, uint16_t color);
    void drawRoundRect(int16_t x, int16_t y, int16_t w, int16_t h, int16_t r, uint16_t color);
    void fillRoundRect(int16_t x, int16_t y, int16_t w, int16_t h, int16_t r, uint16_t color);
    void drawTriangle(int16_t x0, int16_t y0, int16_t x1, int16_t y1, int16_t x2, int16_t y2, uint16_t color);
    void fillTriangle(int16_t x0, int16_t y0, int16_t x1, int16_t y1, int16_t x2, int16_t y2, uint16_t color);
    void drawBitmap(int16_t x, int16_t y, const uint8_t *bitmap, int16_t w, int16_t h, uint16_t color);
    void drawBitmap(int16_t x, int16_t y, const uint8_t *bitmap, int16_t w, int16_t h, uint16_t color, uint16_t bg);
    void drawRGBBitmap(int16_t x, int16_t y, const uint16_t *bitmap, int16_t w, int16_t h);

    void setFont(const Font *f);
    void setCursor(int16_t x, int16_t y);
    void setTextColor(uint16_t c);
    void setTextColor(uint16_t c, uint16_t bg);
    void setTextSize(uint8_t s);
    void setTextSize(uint8_t sx, uint8_t sy);
    void setTextWrap(bool w);

    void drawChar(int16_t x, int16_t y, uint8_t c, uint16_t color, uint16_t bg, uint8_t sizeX, uint8_t sizeY);
    size_t write(uint8_t c);
    void print(const char *s);
    void println(const char *s);
    void println();
    void print(int value);
    void print(unsigned int value);
    void print(long value);
    void print(unsigned long value);
    void print(double value, uint8_t digits = 2);
    void getTextBounds(const char *str, int16_t x, int16_t y, int16_t *x1, int16_t *y1, uint16_t *w, uint16_t *h);

    void drawCharAA(const AAFont *font, int16_t penX, int16_t baselineY, uint16_t c, uint16_t fg, uint16_t bg);
    void drawTextAA(const AAFont *font, int16_t penX, int16_t baselineY, const char *s, uint16_t fg, uint16_t bg);
    void getAATextBounds(const AAFont *font, const char *s, int16_t *minx, int16_t *miny, int16_t *w, int16_t *h);

    virtual bool canPeekPixel() const { return false; }
    virtual uint16_t peekPixel(int16_t x, int16_t y) const;

    int16_t width() const { return _width; }
    int16_t height() const { return _height; }
    int16_t getCursorX() const { return cursor_x; }
    int16_t getCursorY() const { return cursor_y; }
    const Font *getFont() const { return gfxFont; }

  protected:
    void charBounds(uint8_t c, int16_t *x, int16_t *y, int16_t *minx, int16_t *miny, int16_t *maxx, int16_t *maxy);

    int16_t WIDTH;
    int16_t HEIGHT;
    int16_t _width;
    int16_t _height;
    int16_t cursor_x;
    int16_t cursor_y;
    uint16_t textcolor;
    uint16_t textbgcolor;
    uint8_t textsize_x;
    uint8_t textsize_y;
    bool wrap;
    const Font *gfxFont;
};

}

#endif
