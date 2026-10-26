#include "LucarneSwitch.h"
#include <stdio.h>

namespace lucarne {

Switch::Switch(int16_t x, int16_t y, int16_t w, int16_t h, const char *label, const char *key)
    : Widget(x, y, w, h), _label(label), _key(key), _focused(false) {}

void Switch::setTextFont(const AAFont *font) {
    markDirty();
    _textStyle.font = font;
    _textStyle.hasFont = true;
}

void Switch::setTextColor(uint16_t color) {
    markDirty();
    _textStyle.color = color;
    _textStyle.hasColor = true;
    _textStyle.transparent = false;
}

void Switch::setTextTransparent(bool transparent) { markDirty(); _textStyle.transparent = transparent; }

void Switch::setTextSize(uint8_t size) {
    markDirty();
    _textStyle.size = size;
    _textStyle.hasSize = true;
}

void Switch::setTextSpacing(int8_t spacing) {
    markDirty();
    _textStyle.spacing = spacing;
    _textStyle.hasSpacing = true;
}

void Switch::toggle(Store &store) {
    markDirty();
    if (!_key) return;
    store.setBool(_key, !store.getBool(_key, false));
}

void Switch::draw(Gfx &g, const Theme &theme, Store &store) {
    bool on = _key ? store.getBool(_key, false) : false;
    if (g.isCharacterGrid()) {
        char line[48];
        snprintf(line, sizeof(line), "%s%s%s", _label ? _label : "", (_label && _label[0]) ? " " : "",
                 on ? "[ON]" : "[OFF]");
        g.drawGridText(x, y, w, h, line, (uint8_t)TextAlign::Left, _focused);
        return;
    }
    int16_t trackW = (int16_t)(w * 40 / 100);
    if (trackW < 28) trackW = 28;
    int16_t trackH = (int16_t)(h * 55 / 100);
    if (trackH < 14) trackH = 14;
    int16_t tx = (int16_t)(x + w - trackW - theme.padding);
    int16_t ty = (int16_t)(y + (h - trackH) / 2);
    uint16_t track = on ? theme.primary : theme.surfaceEdge;
    g.fillRoundRect(tx, ty, trackW, trackH, (int16_t)(trackH / 2), track);
    int16_t knob = (int16_t)(trackH - 4);
    int16_t kx = on ? (int16_t)(tx + trackW - knob - 2) : (int16_t)(tx + 2);
    int16_t ky = (int16_t)(ty + 2);
    g.fillCircle((int16_t)(kx + knob / 2), (int16_t)(ky + knob / 2), (int16_t)(knob / 2),
                 theme.text);
    int16_t lw = (int16_t)(tx - x - theme.padding);
    if (lw > 0) {
        drawStyledText(g, theme, _label ? _label : "", x, y, lw, h, TextAlign::Left,
                       theme.background, &_textStyle, false);
    }
    if (_focused) {
        g.drawRoundRect(x, y, w, h, 4, theme.primary);
        g.drawRoundRect((int16_t)(x + 1), (int16_t)(y + 1), (int16_t)(w - 2), (int16_t)(h - 2), 4,
                        theme.primary);
    }
}

}
