#include "LucarneImageRle.h"
#include "LucarneWidget.h"
#include "../core/LucarneColor.h"
#include <string.h>

#if defined(ESP32)
#include <pgmspace.h>
#endif

namespace lucarne {

static const size_t kRleRowCap = 160;

static void decodeRowRle(const uint8_t *rle, size_t off, size_t end, uint16_t *pxOut, uint8_t *alOut,
                         int16_t w) {
    for (int16_t i = 0; i < w; i++) {
        pxOut[i] = 0;
        alOut[i] = 0;
    }
    size_t p = off;
    int16_t x = 0;
    while (p < end && x < w) {
#if defined(ESP32)
        uint8_t op = pgm_read_byte(rle + p++);
#else
        uint8_t op = rle[p++];
#endif
        if (op == 0) {
#if defined(ESP32)
            uint8_t run = pgm_read_byte(rle + p++);
#else
            uint8_t run = rle[p++];
#endif
            x = (int16_t)(x + run);
        } else if (op == 1) {
#if defined(ESP32)
            uint8_t run = pgm_read_byte(rle + p++);
            uint16_t c = pgm_read_word(rle + p);
#else
            uint8_t run = rle[p++];
            uint16_t c = (uint16_t)(rle[p] | (rle[p + 1] << 8));
#endif
            p += 2;
            for (uint8_t i = 0; i < run && x < w; i++, x++) {
                pxOut[x] = c;
                alOut[x] = 255;
            }
        } else if (op == 2) {
#if defined(ESP32)
            uint16_t c = pgm_read_word(rle + p);
            uint8_t a = pgm_read_byte(rle + p + 2);
#else
            uint16_t c = (uint16_t)(rle[p] | (rle[p + 1] << 8));
            uint8_t a = rle[p + 2];
#endif
            p += 3;
            if (x < w) {
                pxOut[x] = c;
                alOut[x] = a;
                x++;
            }
        } else {
            break;
        }
    }
}

void drawImageRleFit(Gfx &g, const ImageAsset *asset, int16_t x, int16_t y, int16_t dw, int16_t dh,
                     uint16_t bg) {
    if (!asset || dw < 1 || dh < 1) return;
    const uint8_t *rle = (const uint8_t *)imageAssetData(asset);
    const uint16_t *rowOff = (const uint16_t *)imageAssetAlpha(asset);
    if (!rle || !rowOff) return;
    int16_t sw = imageAssetWidth(asset);
    int16_t sh = imageAssetHeight(asset);
    if (sw < 1 || sh < 1) return;
#if defined(ESP32)
    size_t rleLen = pgm_read_word(&rowOff[sh]);
#else
    size_t rleLen = rowOff[sh];
#endif
    int16_t rw = dw;
    int16_t rh = dh;
    if (sw * dh < sh * dw) {
        rw = (int16_t)((sw * dh) / sh);
        if (rw < 1) rw = 1;
    } else if (sh * dw < sw * dh) {
        rh = (int16_t)((sh * dw) / sw);
        if (rh < 1) rh = 1;
    }
    int16_t ox = (int16_t)(x + (dw - rw) / 2);
    int16_t oy = (int16_t)(y + (dh - rh) / 2);
    if (sw > (int16_t)kRleRowCap) return;
    uint16_t rowPx[kRleRowCap];
    uint8_t rowAl[kRleRowCap];
    int16_t prevSy = -1;
    for (int16_t py = 0; py < rh; py++) {
        int16_t sy = (int16_t)((py * sh) / rh);
        if (sy != prevSy) {
#if defined(ESP32)
            size_t off = pgm_read_word(&rowOff[sy]);
            size_t end = (size_t)sy + 1 < (size_t)sh ? pgm_read_word(&rowOff[sy + 1]) : rleLen;
#else
            size_t off = rowOff[sy];
            size_t end = (size_t)sy + 1 < (size_t)sh ? rowOff[sy + 1] : rleLen;
#endif
            decodeRowRle(rle, off, end, rowPx, rowAl, sw);
            prevSy = sy;
        }
        for (int16_t px = 0; px < rw; px++) {
            int16_t sx = (int16_t)((px * sw) / rw);
            if (sx < 0) sx = 0;
            if (sx >= sw) sx = (int16_t)(sw - 1);
            uint8_t a = rowAl[sx];
            if (a < 8) continue;
            uint16_t fg = rowPx[sx];
            int16_t dx = (int16_t)(ox + px);
            int16_t dy = (int16_t)(oy + py);
            uint16_t under = g.canPeekPixel() ? g.peekPixel(dx, dy) : bg;
            uint16_t out = a >= 250 ? fg : colorBlend(under, fg, a);
            g.writePixel(dx, dy, out);
        }
    }
}

}
