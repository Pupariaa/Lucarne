#include "LucarneWidget.h"
#include "LucarneImageLoader.h"
#include "LucarneImageRle.h"
#include "../core/LucarneUtf8.h"

namespace lucarne {

static uint16_t blendOverPixel(Gfx &g, int16_t x, int16_t y, uint16_t fg, uint8_t a, uint16_t bg) {
    if (a < 8) return bg;
    uint16_t under = g.canPeekPixel() ? g.peekPixel(x, y) : bg;
    return a >= 250 ? fg : colorBlend(under, fg, a);
}

static bool clipSpan(const Gfx &g, int16_t x, int16_t y, int16_t w, int16_t h, int16_t &px0,
                     int16_t &px1, int16_t &py0, int16_t &py1) {
    Rect c = g.clipRect().intersect(Rect(x, y, w, h));
    if (c.empty()) return false;
    px0 = (int16_t)(c.x - x);
    px1 = (int16_t)(c.right() - x);
    py0 = (int16_t)(c.y - y);
    py1 = (int16_t)(c.bottom() - y);
    return true;
}

Widget::Widget(int16_t x, int16_t y, int16_t w, int16_t h)
    : x(x), y(y), w(w), h(h), visible(true), _next(nullptr), _dirty(true) {}

Widget::~Widget() {}

void Widget::setBounds(int16_t nx, int16_t ny, int16_t nw, int16_t nh) {
    if (x == nx && y == ny && w == nw && h == nh) return;
    x = nx;
    y = ny;
    w = nw;
    h = nh;
    markDirty();
}

Rect Widget::boundsLogical(Gfx &g, const Theme &theme) const {
    (void)g;
    (void)theme;
    return Rect(x, y, w, h);
}

uint8_t Widget::storeKeys(const char **out, uint8_t max) const {
    (void)out;
    (void)max;
    return 0;
}

void Widget::onStoreKeyChanged(const char *key, Store &store) {
    (void)key;
    (void)store;
    markDirty();
}

uint8_t Widget::appendKey(const char **out, uint8_t n, uint8_t max, const char *key) {
    if (!key || !key[0] || n >= max) return n;
    for (uint8_t i = 0; i < n; i++) {
        if (out[i] == key) return n;
    }
    out[n] = key;
    return (uint8_t)(n + 1);
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

static void drawTextAASpaced(Gfx &g, const AAFont *font, int16_t penX, int16_t baselineY,
                             const char *text, uint16_t fg, uint16_t bg, int8_t spacing) {
    if (!font || !text) return;
    int16_t pen = penX;
    while (*text) {
        if (*text == '\n') {
            baselineY = (int16_t)(baselineY + font->yAdvance);
            pen = penX;
            text++;
            continue;
        }
        if (*text == '\r') {
            text++;
            continue;
        }
        uint16_t cp = 0;
        const char *next = text;
        if (!utf8NextCodepoint(next, cp)) {
            text = next;
            continue;
        }
        text = next;
        if (cp < font->first || cp > font->last) continue;
        const AAGlyph *gl = &font->glyph[cp - font->first];
        g.drawCharAA(font, pen, baselineY, (uint8_t)cp, fg, bg);
        pen = (int16_t)(pen + gl->xAdvance + spacing);
    }
}

void Widget::drawStyledText(Gfx &g, const Theme &theme, const char *text, int16_t bx, int16_t by,
                            int16_t bw, int16_t bh, TextAlign align, uint16_t bg,
                            const TextStyle *style, bool dimDefault) {
    if (!text || !text[0]) return;
    if (style && style->transparent) return;
    if (g.isCharacterGrid()) {
        g.drawGridText(bx, by, bw, bh, text, (uint8_t)align, false);
        return;
    }
    const AAFont *font = theme.font;
    uint8_t size = theme.textSize;
    uint16_t color = dimDefault ? theme.textDim : theme.text;
    int8_t spacing = 0;
    if (style) {
        if (style->hasFont && style->font) font = style->font;
        if (style->hasSize) size = style->size;
        if (style->hasColor) color = style->color;
        if (style->hasSpacing) spacing = style->spacing;
    }

    if (font) {
        int16_t minx = 0;
        int16_t miny = 0;
        int16_t tw = 0;
        int16_t th = 0;
        g.getAATextBounds(font, text, &minx, &miny, &tw, &th);
        if (style && style->hasSpacing && spacing != 0) {
            tw = 0;
            th = font->pixelSize;
            int16_t pen = 0;
            const char *p = text;
            while (*p) {
                if (*p == '\n' || *p == '\r') {
                    p++;
                    continue;
                }
                uint16_t cp = 0;
                const char *next = p;
                if (!utf8NextCodepoint(next, cp)) {
                    p = next;
                    continue;
                }
                p = next;
                if (cp < font->first || cp > font->last) continue;
                const AAGlyph *gl = &font->glyph[cp - font->first];
                pen = (int16_t)(pen + gl->xAdvance + spacing);
            }
            if (pen > 0) tw = (int16_t)(pen - spacing);
        }
        int16_t left = bx;
        if (align == TextAlign::Center) left = (int16_t)(bx + (bw - tw) / 2);
        else if (align == TextAlign::Right) left = (int16_t)(bx + bw - tw);
        int16_t top = (int16_t)(by + (bh - th) / 2);
        int16_t penX = (int16_t)(left - minx);
        int16_t baseY = (int16_t)(top - miny);
        if (spacing != 0) {
            drawTextAASpaced(g, font, penX, baseY, text, color, bg, spacing);
        } else {
            g.drawTextAA(font, penX, baseY, text, color, bg);
        }
        return;
    }

    drawText(g, theme, text, bx, by, bw, bh, align, color, size, bg, nullptr);
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
    int16_t px0, px1, py0, py1;
    if (!clipSpan(g, x, y, dw, dh, px0, px1, py0, py1)) return;
    for (int16_t py = py0; py < py1; py++) {
        int16_t sy = (int16_t)((py * 16) / dh);
        uint16_t bits = rows[sy];
        if (!bits) continue;
        for (int16_t px = px0; px < px1; px++) {
            int16_t sx = (int16_t)((px * 16) / dw);
            if (bits & (uint16_t)(0x8000 >> sx)) {
                g.drawPixel((int16_t)(x + px), (int16_t)(y + py), color);
            }
        }
    }
}

void Widget::drawImageAsset(Gfx &g, const ImageAsset *asset, int16_t x, int16_t y, int16_t dw,
                            int16_t dh, uint16_t bg) {
    if (!asset || dw < 1 || dh < 1) return;

    if (imageAssetStorage(asset) == ImageStorage::FlashRle) {
        drawImageRleFit(g, asset, x, y, dw, dh, bg);
        return;
    }

    if (isFileBackedStorage(imageAssetStorage(asset)) && !imageAssetData(asset)) {
        drawImageAssetSd(g, asset, x, y, dw, dh, bg);
        return;
    }

    const uint16_t *cached =
        imageAssetStorage(asset) == ImageStorage::Psram ? psramCacheData(asset) : nullptr;
    const uint16_t *pix = cached ? cached : imageAssetData(asset);
    if (!pix) return;
    int16_t sw = imageAssetWidth(asset);
    int16_t sh = imageAssetHeight(asset);
    if (sw < 1) sw = 1;
    if (sh < 1) sh = 1;
    const uint8_t *alpha = cached ? psramCacheAlpha(asset) : imageAssetAlpha(asset);
    int16_t px0, px1, py0, py1;
    if (!clipSpan(g, x, y, dw, dh, px0, px1, py0, py1)) return;
    for (int16_t py = py0; py < py1; py++) {
        int16_t sy = (int16_t)((py * sh) / dh);
        for (int16_t px = px0; px < px1; px++) {
            int16_t sx = (int16_t)((px * sw) / dw);
            size_t si = (size_t)sy * (size_t)sw + (size_t)sx;
            uint8_t a = imageAssetAlphaAt(alpha, si);
            if (a < 8) continue;
            uint16_t fg = imageAssetPixel565(pix, si);
            uint16_t out = blendOverPixel(g, (int16_t)(x + px), (int16_t)(y + py), fg, a, bg);
            g.drawPixel((int16_t)(x + px), (int16_t)(y + py), out);
        }
    }
}

void Widget::drawImageAssetNative(Gfx &g, const ImageAsset *asset, int16_t x, int16_t y,
                                  int16_t srcOx, int16_t srcOy, int16_t viewW, int16_t viewH,
                                  uint16_t bg) {
    if (!asset) return;

    if (imageAssetStorage(asset) == ImageStorage::FlashRle) {
        int16_t dw = viewW > 0 ? viewW : imageAssetWidth(asset);
        int16_t dh = viewH > 0 ? viewH : imageAssetHeight(asset);
        if (dw < 1) dw = 1;
        if (dh < 1) dh = 1;
        drawImageRleFit(g, asset, x, y, dw, dh, bg);
        return;
    }

    if (isFileBackedStorage(imageAssetStorage(asset)) && !imageAssetData(asset)) {
        drawImageAssetSdNative(g, asset, x, y, srcOx, srcOy, viewW, viewH, bg);
        return;
    }

    const uint16_t *cached =
        imageAssetStorage(asset) == ImageStorage::Psram ? psramCacheData(asset) : nullptr;
    const uint16_t *pix = cached ? cached : imageAssetData(asset);
    if (!pix) return;
    int16_t sw = imageAssetWidth(asset);
    int16_t sh = imageAssetHeight(asset);
    if (sw < 1) sw = 1;
    if (sh < 1) sh = 1;
    if (srcOx < 0) srcOx = 0;
    if (srcOy < 0) srcOy = 0;
    int16_t drawW = viewW > 0 ? viewW : (int16_t)(sw - srcOx);
    int16_t drawH = viewH > 0 ? viewH : (int16_t)(sh - srcOy);
    if (drawW < 1) drawW = 1;
    if (drawH < 1) drawH = 1;
    int16_t gw = g.width();
    int16_t gh = g.height();
    const uint8_t *alpha = cached ? psramCacheAlpha(asset) : imageAssetAlpha(asset);
    int16_t px0, px1, py0, py1;
    if (!clipSpan(g, x, y, drawW, drawH, px0, px1, py0, py1)) return;
    for (int16_t py = py0; py < py1; py++) {
        int16_t sy = (int16_t)(srcOy + py);
        if (sy < 0 || sy >= sh) continue;
        for (int16_t px = px0; px < px1; px++) {
            int16_t sx = (int16_t)(srcOx + px);
            if (sx < 0 || sx >= sw) continue;
            int16_t dx = (int16_t)(x + px);
            int16_t dy = (int16_t)(y + py);
            if (dx < 0 || dy < 0 || dx >= gw || dy >= gh) continue;
            size_t si = (size_t)sy * (size_t)sw + (size_t)sx;
            uint8_t a = imageAssetAlphaAt(alpha, si);
            if (a < 8) continue;
            uint16_t fg = imageAssetPixel565(pix, si);
            uint16_t out = blendOverPixel(g, dx, dy, fg, a, bg);
            g.drawPixel(dx, dy, out);
        }
    }
}

void Widget::drawImageAssetFit(Gfx &g, const ImageAsset *asset, int16_t x, int16_t y, int16_t dw,
                               int16_t dh, uint16_t bg) {
    if (!asset || dw < 1 || dh < 1) return;

    if (imageAssetStorage(asset) == ImageStorage::FlashRle) {
        drawImageRleFit(g, asset, x, y, dw, dh, bg);
        return;
    }

    if (isFileBackedStorage(imageAssetStorage(asset)) && !imageAssetData(asset)) {
        drawImageAssetSd(g, asset, x, y, dw, dh, bg);
        return;
    }

    const uint16_t *cached =
        imageAssetStorage(asset) == ImageStorage::Psram ? psramCacheData(asset) : nullptr;
    const uint16_t *pix = cached ? cached : imageAssetData(asset);
    if (!pix) return;
    int16_t sw = imageAssetWidth(asset);
    int16_t sh = imageAssetHeight(asset);
    if (sw < 1) sw = 1;
    if (sh < 1) sh = 1;
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
    const uint8_t *alpha = cached ? psramCacheAlpha(asset) : imageAssetAlpha(asset);
    int16_t px0, px1, py0, py1;
    if (!clipSpan(g, ox, oy, rw, rh, px0, px1, py0, py1)) return;
    for (int16_t py = py0; py < py1; py++) {
        int16_t sy = (int16_t)((py * sh) / rh);
        for (int16_t px = px0; px < px1; px++) {
            int16_t sx = (int16_t)((px * sw) / rw);
            size_t si = (size_t)sy * (size_t)sw + (size_t)sx;
            uint8_t a = imageAssetAlphaAt(alpha, si);
            if (a < 8) continue;
            uint16_t fg = imageAssetPixel565(pix, si);
            int16_t dx = (int16_t)(ox + px);
            int16_t dy = (int16_t)(oy + py);
            uint16_t out = blendOverPixel(g, dx, dy, fg, a, bg);
            g.drawPixel(dx, dy, out);
        }
    }
}

void Widget::drawRamImageFit(Gfx &g, const uint16_t *pix, const uint8_t *alpha, int16_t sw,
                             int16_t sh, int16_t x, int16_t y, int16_t dw, int16_t dh,
                             uint16_t bg) {
    if (!pix || sw < 1 || sh < 1 || dw < 1 || dh < 1) return;
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
    int16_t px0, px1, py0, py1;
    if (!clipSpan(g, ox, oy, rw, rh, px0, px1, py0, py1)) return;
    for (int16_t py = py0; py < py1; py++) {
        int16_t sy = (int16_t)((py * sh) / rh);
        for (int16_t px = px0; px < px1; px++) {
            int16_t sx = (int16_t)((px * sw) / rw);
            size_t si = (size_t)sy * (size_t)sw + (size_t)sx;
            uint8_t a = alpha ? alpha[si] : 255;
            if (a < 8) continue;
            uint16_t fg = pix[si];
            int16_t dx = (int16_t)(ox + px);
            int16_t dy = (int16_t)(oy + py);
            uint16_t out = blendOverPixel(g, dx, dy, fg, a, bg);
            g.drawPixel(dx, dy, out);
        }
    }
}

}
