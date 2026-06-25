#include "LucarneSwitch.h"

namespace lucarne {

Switch::Switch(int16_t x, int16_t y, int16_t w, int16_t h, const char *label, const char *key)
    : Widget(x, y, w, h), _label(label), _key(key) {}

void Switch::toggle(Store &store) {
    if (!_key) return;
    store.setBool(_key, !store.getBool(_key, false));
}

void Switch::draw(Gfx &g, const Theme &theme, Store &store) {
    bool on = _key ? store.getBool(_key, false) : false;
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
        drawText(g, theme, _label ? _label : "", x, y, lw, h, TextAlign::Left, theme.text,
                 theme.textSize, theme.background, theme.font);
    }
}

}
