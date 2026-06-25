#include "LucarneIconDraw.h"
#include "LucarneIcons.h"
#include "LucarneWidget.h"
#include "../core/LucarneColor.h"
#include <Arduino.h>
#include <string.h>

namespace lucarne {

static IconRowsLookup _rowsLookup = nullptr;
static IconImageLookup _imageLookup = nullptr;

void setIconLookups(IconRowsLookup rows, IconImageLookup image) {
    _rowsLookup = rows;
    _imageLookup = image;
}

static bool refEmpty(const char *ref) {
    return !ref || !ref[0] || strcmp(ref, "none") == 0;
}

bool iconRefValid(const char *ref) {
    if (refEmpty(ref)) return false;
    if (iconFromName(ref) != IconId::None) return true;
    if (_rowsLookup && _rowsLookup(ref)) return true;
    if (_imageLookup && _imageLookup(ref)) return true;
    return false;
}

int16_t iconRefBaseSize(const char *ref) {
    if (refEmpty(ref)) return 0;
    if (_imageLookup) {
        const ImageAsset *img = _imageLookup(ref);
        if (img && img->data) return img->width > 0 ? img->width : 16;
    }
    return 16;
}

void drawIconRef(Gfx &g, const char *ref, int16_t x, int16_t y, int16_t dw, int16_t dh, uint16_t tint,
                 uint16_t bg) {
    if (refEmpty(ref) || dw < 1 || dh < 1) return;

    IconId id = iconFromName(ref);
    if (id != IconId::None) {
        const uint16_t *rows = iconData(id);
        if (dw == 16 && dh == 16) {
            Widget::drawIcon(g, rows, x, y, 1, tint);
        } else {
            Widget::drawIconFit(g, rows, x, y, dw, dh, tint);
        }
        return;
    }

    if (_rowsLookup) {
        const uint16_t *rows = _rowsLookup(ref);
        if (rows) {
            if (dw == 16 && dh == 16) {
                Widget::drawIcon(g, rows, x, y, 1, tint);
            } else {
                Widget::drawIconFit(g, rows, x, y, dw, dh, tint);
            }
            return;
        }
    }

    if (_imageLookup) {
        const ImageAsset *img = _imageLookup(ref);
        if (img && img->data) {
            Widget::drawImageAsset(g, img, x, y, dw, dh, bg);
        }
    }
}

}
