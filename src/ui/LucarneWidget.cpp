#include "LucarneWidget.h"

namespace lucarne {

Widget::Widget(int16_t x, int16_t y, int16_t w, int16_t h)
    : x(x), y(y), w(w), h(h), visible(true), _next(nullptr) {}

Widget::~Widget() {}

void Widget::setBounds(int16_t nx, int16_t ny, int16_t nw, int16_t nh) {
    x = nx;
    y = ny;
    w = nw;
    h = nh;
}

void Widget::drawText(Gfx &g, const Theme &theme, const char *text, int16_t bx, int16_t by,
                      int16_t bw, int16_t bh, TextAlign align, uint16_t color, uint8_t size,
                      uint16_t bg, const AAFont *aafont) {
    if (!text || !text[0]) return;

    if (aafont) {
        int16_t minx = 0;
        int16_t miny = 0;
        int16_t tw = 0;
        int16_t th = 0;
        g.getAATextBounds(aafont, text, &minx, &miny, &tw, &th);
        int16_t left = bx;
        if (align == TextAlign::Center) {
            left = (int16_t)(bx + (bw - tw) / 2);
        } else if (align == TextAlign::Right) {
            left = (int16_t)(bx + bw - tw);
        }
        int16_t top = (int16_t)(by + (bh - th) / 2);
        int16_t penX = (int16_t)(left - minx);
        int16_t baseY = (int16_t)(top - miny);
        g.drawTextAA(aafont, penX, baseY, text, color, bg);
        return;
    }

    g.setFont(nullptr);
    g.setTextSize(size);
    g.setTextColor(color);

    int16_t tx1 = 0;
    int16_t ty1 = 0;
    uint16_t tw = 0;
    uint16_t th = 0;
    g.getTextBounds(text, 0, 0, &tx1, &ty1, &tw, &th);

    int16_t cx = bx;
    if (align == TextAlign::Center) {
        cx = (int16_t)(bx + (bw - (int16_t)tw) / 2);
    } else if (align == TextAlign::Right) {
        cx = (int16_t)(bx + bw - (int16_t)tw);
    }
    int16_t cy = (int16_t)(by + (bh - (int16_t)th) / 2);

    g.setCursor((int16_t)(cx - tx1), (int16_t)(cy - ty1));
    g.print(text);
}

void Widget::drawIcon(Gfx &g, const uint16_t *rows, int16_t x, int16_t y, uint8_t scale,
                      uint16_t color) {
    if (!rows) return;
    if (scale < 1) scale = 1;
    for (uint8_t ry = 0; ry < 16; ry++) {
        uint16_t bits = rows[ry];
        if (!bits) continue;
        for (uint8_t rx = 0; rx < 16; rx++) {
            if (bits & (uint16_t)(0x8000 >> rx)) {
                if (scale == 1) {
                    g.drawPixel((int16_t)(x + rx), (int16_t)(y + ry), color);
                } else {
                    g.fillRect((int16_t)(x + rx * scale), (int16_t)(y + ry * scale), scale, scale,
                               color);
                }
            }
        }
    }
}

void Widget::drawIconFit(Gfx &g, const uint16_t *rows, int16_t x, int16_t y, int16_t dw,
                         int16_t dh, uint16_t color) {
    if (!rows || dw < 1 || dh < 1) return;
    for (int16_t py = 0; py < dh; py++) {
        int16_t sy = (int16_t)((py * 16) / dh);
        uint16_t bits = rows[sy];
        if (!bits) continue;
        for (int16_t px = 0; px < dw; px++) {
            int16_t sx = (int16_t)((px * 16) / dw);
            if (bits & (uint16_t)(0x8000 >> sx)) {
                g.drawPixel((int16_t)(x + px), (int16_t)(y + py), color);
            }
        }
    }
}

}
