#include "LucarneGfx.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

namespace lucarne {

static inline void swapInt16(int16_t &a, int16_t &b) {
    int16_t t = a;
    a = b;
    b = t;
}

Gfx::Gfx(int16_t w, int16_t h)
    : WIDTH(w), HEIGHT(h), _width(w), _height(h), cursor_x(0), cursor_y(0),
      textcolor(0xFFFF), textbgcolor(0xFFFF), textsize_x(1), textsize_y(1),
      wrap(true), gfxFont(nullptr) {}

Gfx::~Gfx() {}

void Gfx::startWrite() {}

void Gfx::endWrite() {}

void Gfx::writeFillRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color) {
    for (int16_t i = 0; i < h; i++) {
        for (int16_t j = 0; j < w; j++) {
            writePixel((int16_t)(x + j), (int16_t)(y + i), color);
        }
    }
}

void Gfx::writeFastHLine(int16_t x, int16_t y, int16_t w, uint16_t color) {
    writeFillRect(x, y, w, 1, color);
}

void Gfx::writeFastVLine(int16_t x, int16_t y, int16_t h, uint16_t color) {
    writeFillRect(x, y, 1, h, color);
}

void Gfx::drawPixel(int16_t x, int16_t y, uint16_t color) {
    startWrite();
    writePixel(x, y, color);
    endWrite();
}

void Gfx::drawFastHLine(int16_t x, int16_t y, int16_t w, uint16_t color) {
    if (w < 0) {
        x += w + 1;
        w = (int16_t)(-w);
    }
    startWrite();
    writeFastHLine(x, y, w, color);
    endWrite();
}

void Gfx::drawFastVLine(int16_t x, int16_t y, int16_t h, uint16_t color) {
    if (h < 0) {
        y += h + 1;
        h = (int16_t)(-h);
    }
    startWrite();
    writeFastVLine(x, y, h, color);
    endWrite();
}

void Gfx::fillRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color) {
    if (w < 0) {
        x += w + 1;
        w = (int16_t)(-w);
    }
    if (h < 0) {
        y += h + 1;
        h = (int16_t)(-h);
    }
    startWrite();
    writeFillRect(x, y, w, h, color);
    endWrite();
}

void Gfx::fillScreen(uint16_t color) {
    fillRect(0, 0, _width, _height, color);
}

void Gfx::drawLine(int16_t x0, int16_t y0, int16_t x1, int16_t y1, uint16_t color) {
    if (x0 == x1) {
        if (y0 > y1) swapInt16(y0, y1);
        drawFastVLine(x0, y0, (int16_t)(y1 - y0 + 1), color);
        return;
    }
    if (y0 == y1) {
        if (x0 > x1) swapInt16(x0, x1);
        drawFastHLine(x0, y0, (int16_t)(x1 - x0 + 1), color);
        return;
    }
    bool steep = (int16_t)abs(y1 - y0) > (int16_t)abs(x1 - x0);
    if (steep) {
        swapInt16(x0, y0);
        swapInt16(x1, y1);
    }
    if (x0 > x1) {
        swapInt16(x0, x1);
        swapInt16(y0, y1);
    }
    int16_t dx = (int16_t)(x1 - x0);
    int16_t dy = (int16_t)abs(y1 - y0);
    int16_t err = (int16_t)(dx / 2);
    int16_t ystep = (y0 < y1) ? 1 : -1;
    startWrite();
    for (; x0 <= x1; x0++) {
        if (steep) {
            writePixel(y0, x0, color);
        } else {
            writePixel(x0, y0, color);
        }
        err -= dy;
        if (err < 0) {
            y0 += ystep;
            err += dx;
        }
    }
    endWrite();
}

void Gfx::drawRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color) {
    startWrite();
    writeFastHLine(x, y, w, color);
    writeFastHLine(x, (int16_t)(y + h - 1), w, color);
    writeFastVLine(x, y, h, color);
    writeFastVLine((int16_t)(x + w - 1), y, h, color);
    endWrite();
}

void Gfx::drawCircle(int16_t x0, int16_t y0, int16_t r, uint16_t color) {
    int16_t f = (int16_t)(1 - r);
    int16_t ddF_x = 1;
    int16_t ddF_y = (int16_t)(-2 * r);
    int16_t x = 0;
    int16_t y = r;
    startWrite();
    writePixel(x0, (int16_t)(y0 + r), color);
    writePixel(x0, (int16_t)(y0 - r), color);
    writePixel((int16_t)(x0 + r), y0, color);
    writePixel((int16_t)(x0 - r), y0, color);
    while (x < y) {
        if (f >= 0) {
            y--;
            ddF_y += 2;
            f += ddF_y;
        }
        x++;
        ddF_x += 2;
        f += ddF_x;
        writePixel((int16_t)(x0 + x), (int16_t)(y0 + y), color);
        writePixel((int16_t)(x0 - x), (int16_t)(y0 + y), color);
        writePixel((int16_t)(x0 + x), (int16_t)(y0 - y), color);
        writePixel((int16_t)(x0 - x), (int16_t)(y0 - y), color);
        writePixel((int16_t)(x0 + y), (int16_t)(y0 + x), color);
        writePixel((int16_t)(x0 - y), (int16_t)(y0 + x), color);
        writePixel((int16_t)(x0 + y), (int16_t)(y0 - x), color);
        writePixel((int16_t)(x0 - y), (int16_t)(y0 - x), color);
    }
    endWrite();
}

void Gfx::drawCircleHelper(int16_t x0, int16_t y0, int16_t r, uint8_t corner, uint16_t color) {
    int16_t f = (int16_t)(1 - r);
    int16_t ddF_x = 1;
    int16_t ddF_y = (int16_t)(-2 * r);
    int16_t x = 0;
    int16_t y = r;
    while (x < y) {
        if (f >= 0) {
            y--;
            ddF_y += 2;
            f += ddF_y;
        }
        x++;
        ddF_x += 2;
        f += ddF_x;
        if (corner & 0x4) {
            writePixel((int16_t)(x0 + x), (int16_t)(y0 + y), color);
            writePixel((int16_t)(x0 + y), (int16_t)(y0 + x), color);
        }
        if (corner & 0x2) {
            writePixel((int16_t)(x0 + x), (int16_t)(y0 - y), color);
            writePixel((int16_t)(x0 + y), (int16_t)(y0 - x), color);
        }
        if (corner & 0x8) {
            writePixel((int16_t)(x0 - y), (int16_t)(y0 + x), color);
            writePixel((int16_t)(x0 - x), (int16_t)(y0 + y), color);
        }
        if (corner & 0x1) {
            writePixel((int16_t)(x0 - y), (int16_t)(y0 - x), color);
            writePixel((int16_t)(x0 - x), (int16_t)(y0 - y), color);
        }
    }
}

void Gfx::fillCircle(int16_t x0, int16_t y0, int16_t r, uint16_t color) {
    startWrite();
    writeFastVLine(x0, (int16_t)(y0 - r), (int16_t)(2 * r + 1), color);
    fillCircleHelper(x0, y0, r, 3, 0, color);
    endWrite();
}

void Gfx::fillCircleHelper(int16_t x0, int16_t y0, int16_t r, uint8_t corner, int16_t delta, uint16_t color) {
    int16_t f = (int16_t)(1 - r);
    int16_t ddF_x = 1;
    int16_t ddF_y = (int16_t)(-2 * r);
    int16_t x = 0;
    int16_t y = r;
    int16_t px = x;
    int16_t py = y;
    delta++;
    while (x < y) {
        if (f >= 0) {
            y--;
            ddF_y += 2;
            f += ddF_y;
        }
        x++;
        ddF_x += 2;
        f += ddF_x;
        if (x < (int16_t)(y + 1)) {
            if (corner & 1) writeFastVLine((int16_t)(x0 + x), (int16_t)(y0 - y), (int16_t)(2 * y + delta), color);
            if (corner & 2) writeFastVLine((int16_t)(x0 - x), (int16_t)(y0 - y), (int16_t)(2 * y + delta), color);
        }
        if (y != py) {
            if (corner & 1) writeFastVLine((int16_t)(x0 + py), (int16_t)(y0 - px), (int16_t)(2 * px + delta), color);
            if (corner & 2) writeFastVLine((int16_t)(x0 - py), (int16_t)(y0 - px), (int16_t)(2 * px + delta), color);
            py = y;
        }
        px = x;
    }
}

void Gfx::drawRoundRect(int16_t x, int16_t y, int16_t w, int16_t h, int16_t r, uint16_t color) {
    int16_t maxRadius = (int16_t)((w < h ? w : h) / 2);
    if (r > maxRadius) r = maxRadius;
    startWrite();
    writeFastHLine((int16_t)(x + r), y, (int16_t)(w - 2 * r), color);
    writeFastHLine((int16_t)(x + r), (int16_t)(y + h - 1), (int16_t)(w - 2 * r), color);
    writeFastVLine(x, (int16_t)(y + r), (int16_t)(h - 2 * r), color);
    writeFastVLine((int16_t)(x + w - 1), (int16_t)(y + r), (int16_t)(h - 2 * r), color);
    drawCircleHelper((int16_t)(x + r), (int16_t)(y + r), r, 1, color);
    drawCircleHelper((int16_t)(x + w - r - 1), (int16_t)(y + r), r, 2, color);
    drawCircleHelper((int16_t)(x + w - r - 1), (int16_t)(y + h - r - 1), r, 4, color);
    drawCircleHelper((int16_t)(x + r), (int16_t)(y + h - r - 1), r, 8, color);
    endWrite();
}

void Gfx::fillRoundRect(int16_t x, int16_t y, int16_t w, int16_t h, int16_t r, uint16_t color) {
    int16_t maxRadius = (int16_t)((w < h ? w : h) / 2);
    if (r > maxRadius) r = maxRadius;
    startWrite();
    writeFillRect((int16_t)(x + r), y, (int16_t)(w - 2 * r), h, color);
    fillCircleHelper((int16_t)(x + w - r - 1), (int16_t)(y + r), r, 1, (int16_t)(h - 2 * r - 1), color);
    fillCircleHelper((int16_t)(x + r), (int16_t)(y + r), r, 2, (int16_t)(h - 2 * r - 1), color);
    endWrite();
}

void Gfx::drawTriangle(int16_t x0, int16_t y0, int16_t x1, int16_t y1, int16_t x2, int16_t y2, uint16_t color) {
    drawLine(x0, y0, x1, y1, color);
    drawLine(x1, y1, x2, y2, color);
    drawLine(x2, y2, x0, y0, color);
}

void Gfx::fillTriangle(int16_t x0, int16_t y0, int16_t x1, int16_t y1, int16_t x2, int16_t y2, uint16_t color) {
    int16_t a, b, y, last;
    if (y0 > y1) {
        swapInt16(y0, y1);
        swapInt16(x0, x1);
    }
    if (y1 > y2) {
        swapInt16(y2, y1);
        swapInt16(x2, x1);
    }
    if (y0 > y1) {
        swapInt16(y0, y1);
        swapInt16(x0, x1);
    }
    startWrite();
    if (y0 == y2) {
        a = b = x0;
        if (x1 < a) a = x1;
        else if (x1 > b) b = x1;
        if (x2 < a) a = x2;
        else if (x2 > b) b = x2;
        writeFastHLine(a, y0, (int16_t)(b - a + 1), color);
        endWrite();
        return;
    }
    int16_t dx01 = (int16_t)(x1 - x0), dy01 = (int16_t)(y1 - y0);
    int16_t dx02 = (int16_t)(x2 - x0), dy02 = (int16_t)(y2 - y0);
    int16_t dx12 = (int16_t)(x2 - x1), dy12 = (int16_t)(y2 - y1);
    int32_t sa = 0, sb = 0;
    if (y1 == y2) last = y1;
    else last = (int16_t)(y1 - 1);
    for (y = y0; y <= last; y++) {
        a = (int16_t)(x0 + sa / dy01);
        b = (int16_t)(x0 + sb / dy02);
        sa += dx01;
        sb += dx02;
        if (a > b) swapInt16(a, b);
        writeFastHLine(a, y, (int16_t)(b - a + 1), color);
    }
    sa = (int32_t)dx12 * (int32_t)(y - y1);
    sb = (int32_t)dx02 * (int32_t)(y - y0);
    for (; y <= y2; y++) {
        a = (int16_t)(x1 + sa / dy12);
        b = (int16_t)(x0 + sb / dy02);
        sa += dx12;
        sb += dx02;
        if (a > b) swapInt16(a, b);
        writeFastHLine(a, y, (int16_t)(b - a + 1), color);
    }
    endWrite();
}

void Gfx::drawBitmap(int16_t x, int16_t y, const uint8_t *bitmap, int16_t w, int16_t h, uint16_t color) {
    int16_t byteWidth = (int16_t)((w + 7) / 8);
    uint8_t b = 0;
    startWrite();
    for (int16_t j = 0; j < h; j++) {
        for (int16_t i = 0; i < w; i++) {
            if (i & 7) {
                b <<= 1;
            } else {
                b = bitmap[j * byteWidth + i / 8];
            }
            if (b & 0x80) writePixel((int16_t)(x + i), (int16_t)(y + j), color);
        }
    }
    endWrite();
}

void Gfx::drawBitmap(int16_t x, int16_t y, const uint8_t *bitmap, int16_t w, int16_t h, uint16_t color, uint16_t bg) {
    int16_t byteWidth = (int16_t)((w + 7) / 8);
    uint8_t b = 0;
    startWrite();
    for (int16_t j = 0; j < h; j++) {
        for (int16_t i = 0; i < w; i++) {
            if (i & 7) {
                b <<= 1;
            } else {
                b = bitmap[j * byteWidth + i / 8];
            }
            writePixel((int16_t)(x + i), (int16_t)(y + j), (b & 0x80) ? color : bg);
        }
    }
    endWrite();
}

void Gfx::drawRGBBitmap(int16_t x, int16_t y, const uint16_t *bitmap, int16_t w, int16_t h) {
    startWrite();
    for (int16_t j = 0; j < h; j++) {
        for (int16_t i = 0; i < w; i++) {
            writePixel((int16_t)(x + i), (int16_t)(y + j), bitmap[j * w + i]);
        }
    }
    endWrite();
}

void Gfx::setFont(const Font *f) {
    gfxFont = f;
}

void Gfx::setCursor(int16_t x, int16_t y) {
    cursor_x = x;
    cursor_y = y;
}

void Gfx::setTextColor(uint16_t c) {
    textcolor = c;
    textbgcolor = c;
}

void Gfx::setTextColor(uint16_t c, uint16_t bg) {
    textcolor = c;
    textbgcolor = bg;
}

void Gfx::setTextSize(uint8_t s) {
    setTextSize(s, s);
}

void Gfx::setTextSize(uint8_t sx, uint8_t sy) {
    textsize_x = sx ? sx : 1;
    textsize_y = sy ? sy : 1;
}

void Gfx::setTextWrap(bool w) {
    wrap = w;
}

void Gfx::drawChar(int16_t x, int16_t y, uint8_t c, uint16_t color, uint16_t bg, uint8_t sizeX, uint8_t sizeY) {
    if (!gfxFont) {
        if (x >= _width || y >= _height || (x + 6 * sizeX - 1) < 0 || (y + 8 * sizeY - 1) < 0) return;
        startWrite();
        for (int8_t i = 0; i < 5; i++) {
            uint8_t line = LucarneClassicFont[c * 5 + i];
            for (int8_t j = 0; j < 8; j++, line >>= 1) {
                if (line & 1) {
                    if (sizeX == 1 && sizeY == 1) {
                        writePixel((int16_t)(x + i), (int16_t)(y + j), color);
                    } else {
                        writeFillRect((int16_t)(x + i * sizeX), (int16_t)(y + j * sizeY), sizeX, sizeY, color);
                    }
                } else if (bg != color) {
                    if (sizeX == 1 && sizeY == 1) {
                        writePixel((int16_t)(x + i), (int16_t)(y + j), bg);
                    } else {
                        writeFillRect((int16_t)(x + i * sizeX), (int16_t)(y + j * sizeY), sizeX, sizeY, bg);
                    }
                }
            }
        }
        if (bg != color) {
            if (sizeX == 1 && sizeY == 1) {
                writeFastVLine((int16_t)(x + 5), y, 8, bg);
            } else {
                writeFillRect((int16_t)(x + 5 * sizeX), y, sizeX, (int16_t)(8 * sizeY), bg);
            }
        }
        endWrite();
        return;
    }

    if (c < gfxFont->first || c > gfxFont->last) return;
    const Glyph *glyph = &gfxFont->glyph[c - gfxFont->first];
    const uint8_t *bitmap = gfxFont->bitmap;
    uint16_t bo = glyph->bitmapOffset;
    uint8_t w = glyph->width;
    uint8_t h = glyph->height;
    int8_t xo = glyph->xOffset;
    int8_t yo = glyph->yOffset;
    uint8_t bits = 0;
    uint8_t bit = 0;
    startWrite();
    for (uint8_t yy = 0; yy < h; yy++) {
        for (uint8_t xx = 0; xx < w; xx++) {
            if (!(bit++ & 7)) {
                bits = bitmap[bo++];
            }
            if (bits & 0x80) {
                if (sizeX == 1 && sizeY == 1) {
                    writePixel((int16_t)(x + xo + xx), (int16_t)(y + yo + yy), color);
                } else {
                    writeFillRect((int16_t)(x + (xo + xx) * sizeX), (int16_t)(y + (yo + yy) * sizeY), sizeX, sizeY, color);
                }
            }
            bits <<= 1;
        }
    }
    endWrite();
}

size_t Gfx::write(uint8_t c) {
    if (!gfxFont) {
        if (c == '\n') {
            cursor_x = 0;
            cursor_y += (int16_t)(textsize_y * 8);
        } else if (c != '\r') {
            if (wrap && (cursor_x + textsize_x * 6) > _width) {
                cursor_x = 0;
                cursor_y += (int16_t)(textsize_y * 8);
            }
            drawChar(cursor_x, cursor_y, c, textcolor, textbgcolor, textsize_x, textsize_y);
            cursor_x += (int16_t)(textsize_x * 6);
        }
        return 1;
    }

    if (c == '\n') {
        cursor_x = 0;
        cursor_y += (int16_t)(textsize_y * gfxFont->yAdvance);
    } else if (c != '\r') {
        if (c >= gfxFont->first && c <= gfxFont->last) {
            const Glyph *glyph = &gfxFont->glyph[c - gfxFont->first];
            uint8_t w = glyph->width;
            uint8_t h = glyph->height;
            if (w > 0 && h > 0) {
                int16_t xo = glyph->xOffset;
                if (wrap && ((cursor_x + textsize_x * (xo + w)) > _width)) {
                    cursor_x = 0;
                    cursor_y += (int16_t)(textsize_y * gfxFont->yAdvance);
                }
                drawChar(cursor_x, cursor_y, c, textcolor, textbgcolor, textsize_x, textsize_y);
            }
            cursor_x += (int16_t)(glyph->xAdvance * textsize_x);
        }
    }
    return 1;
}

void Gfx::print(const char *s) {
    if (!s) return;
    while (*s) {
        write((uint8_t)*s++);
    }
}

void Gfx::println(const char *s) {
    print(s);
    write((uint8_t)'\n');
}

void Gfx::println() {
    write((uint8_t)'\n');
}

void Gfx::print(int value) {
    char buf[16];
    snprintf(buf, sizeof(buf), "%d", value);
    print(buf);
}

void Gfx::print(unsigned int value) {
    char buf[16];
    snprintf(buf, sizeof(buf), "%u", value);
    print(buf);
}

void Gfx::print(long value) {
    char buf[24];
    snprintf(buf, sizeof(buf), "%ld", value);
    print(buf);
}

void Gfx::print(unsigned long value) {
    char buf[24];
    snprintf(buf, sizeof(buf), "%lu", value);
    print(buf);
}

void Gfx::print(double value, uint8_t digits) {
    char buf[24];
    char fmt[8];
    snprintf(fmt, sizeof(fmt), "%%.%uf", (unsigned)digits);
    snprintf(buf, sizeof(buf), fmt, value);
    print(buf);
}

void Gfx::charBounds(uint8_t c, int16_t *x, int16_t *y, int16_t *minx, int16_t *miny, int16_t *maxx, int16_t *maxy) {
    if (!gfxFont) {
        if (c == '\n') {
            *x = 0;
            *y += (int16_t)(textsize_y * 8);
        } else if (c != '\r') {
            int16_t tsw = (int16_t)(textsize_x * 6);
            int16_t tsh = (int16_t)(textsize_y * 8);
            if (wrap && ((*x + tsw) > _width)) {
                *x = 0;
                *y += tsh;
            }
            int16_t x2 = (int16_t)(*x + tsw - 1);
            int16_t y2 = (int16_t)(*y + tsh - 1);
            if (x2 > *maxx) *maxx = x2;
            if (y2 > *maxy) *maxy = y2;
            if (*x < *minx) *minx = *x;
            if (*y < *miny) *miny = *y;
            *x += tsw;
        }
        return;
    }
    if (c == '\n') {
        *x = 0;
        *y += (int16_t)(textsize_y * gfxFont->yAdvance);
    } else if (c != '\r') {
        if (c >= gfxFont->first && c <= gfxFont->last) {
            const Glyph *glyph = &gfxFont->glyph[c - gfxFont->first];
            uint8_t gw = glyph->width;
            uint8_t gh = glyph->height;
            uint8_t xa = glyph->xAdvance;
            int8_t xo = glyph->xOffset;
            int8_t yo = glyph->yOffset;
            if (wrap && ((*x + (((int16_t)xo + gw) * textsize_x)) > _width)) {
                *x = 0;
                *y += (int16_t)(textsize_y * gfxFont->yAdvance);
            }
            int16_t tsx = textsize_x;
            int16_t tsy = textsize_y;
            int16_t x1 = (int16_t)(*x + xo * tsx);
            int16_t y1 = (int16_t)(*y + yo * tsy);
            int16_t x2 = (int16_t)(x1 + gw * tsx - 1);
            int16_t y2 = (int16_t)(y1 + gh * tsy - 1);
            if (x1 < *minx) *minx = x1;
            if (y1 < *miny) *miny = y1;
            if (x2 > *maxx) *maxx = x2;
            if (y2 > *maxy) *maxy = y2;
            *x += (int16_t)(xa * tsx);
        }
    }
}

void Gfx::getTextBounds(const char *str, int16_t x, int16_t y, int16_t *x1, int16_t *y1, uint16_t *w, uint16_t *h) {
    *x1 = x;
    *y1 = y;
    *w = 0;
    *h = 0;
    int16_t minx = _width;
    int16_t miny = _height;
    int16_t maxx = -1;
    int16_t maxy = -1;
    while (*str) {
        charBounds((uint8_t)*str++, &x, &y, &minx, &miny, &maxx, &maxy);
    }
    if (maxx >= minx) {
        *x1 = minx;
        *w = (uint16_t)(maxx - minx + 1);
    }
    if (maxy >= miny) {
        *y1 = miny;
        *h = (uint16_t)(maxy - miny + 1);
    }
}

void Gfx::drawCharAA(const AAFont *font, int16_t penX, int16_t baselineY, uint16_t c, uint16_t fg, uint16_t bg) {
    if (!font) return;
    if (c < font->first || c > font->last) return;
    const AAGlyph *gl = &font->glyph[c - font->first];
    if (gl->width == 0 || gl->height == 0) return;
    const uint8_t *cov = font->coverage + gl->coverageOffset;
    int16_t gx = (int16_t)(penX + gl->xOffset);
    int16_t gy = (int16_t)(baselineY + gl->yOffset);
    startWrite();
    for (uint8_t yy = 0; yy < gl->height; yy++) {
        for (uint8_t xx = 0; xx < gl->width; xx++) {
            uint8_t a = cov[yy * gl->width + xx];
            if (a == 0) continue;
            uint16_t out = (a >= 250) ? fg : colorBlend(bg, fg, a);
            writePixel((int16_t)(gx + xx), (int16_t)(gy + yy), out);
        }
    }
    endWrite();
}

void Gfx::drawTextAA(const AAFont *font, int16_t penX, int16_t baselineY, const char *s, uint16_t fg, uint16_t bg) {
    if (!font || !s) return;
    int16_t pen = penX;
    while (*s) {
        uint8_t c = (uint8_t)*s++;
        if (c == '\n') {
            baselineY = (int16_t)(baselineY + font->yAdvance);
            pen = penX;
            continue;
        }
        if (c < font->first || c > font->last) continue;
        const AAGlyph *gl = &font->glyph[c - font->first];
        drawCharAA(font, pen, baselineY, c, fg, bg);
        pen = (int16_t)(pen + gl->xAdvance);
    }
}

void Gfx::getAATextBounds(const AAFont *font, const char *s, int16_t *minx, int16_t *miny, int16_t *w, int16_t *h) {
    *minx = 0;
    *miny = 0;
    *w = 0;
    *h = 0;
    if (!font || !s || !*s) return;
    int16_t pen = 0;
    int16_t loX = 32767, loY = 32767, hiX = -32768, hiY = -32768;
    while (*s) {
        uint8_t c = (uint8_t)*s++;
        if (c < font->first || c > font->last) continue;
        const AAGlyph *gl = &font->glyph[c - font->first];
        if (gl->width > 0 && gl->height > 0) {
            int16_t gx = (int16_t)(pen + gl->xOffset);
            int16_t gy = gl->yOffset;
            if (gx < loX) loX = gx;
            if (gy < loY) loY = gy;
            if ((int16_t)(gx + gl->width) > hiX) hiX = (int16_t)(gx + gl->width);
            if ((int16_t)(gy + gl->height) > hiY) hiY = (int16_t)(gy + gl->height);
        }
        pen = (int16_t)(pen + gl->xAdvance);
    }
    if (hiX > loX) {
        *minx = loX;
        *w = (int16_t)(hiX - loX);
    }
    if (hiY > loY) {
        *miny = loY;
        *h = (int16_t)(hiY - loY);
    }
}

}
