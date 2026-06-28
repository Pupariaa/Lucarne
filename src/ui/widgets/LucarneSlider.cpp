#include "LucarneSlider.h"

namespace lucarne {

Slider::Slider(int16_t x, int16_t y, int16_t w, int16_t h, const char *key, float minV, float maxV)
    : Widget(x, y, w, h), _key(key), _min(minV), _max(maxV), _color(0), _hasColor(false),
      _transparentColor(false) {}

void Slider::setColor(uint16_t c) {
    _color = c;
    _hasColor = true;
    _transparentColor = false;
}

void Slider::clearColor() { _transparentColor = true; _hasColor = false; }

void Slider::draw(Gfx &g, const Theme &theme, Store &store) {
    float v = _key ? store.getFloat(_key, _min) : _min;
    if (v < _min) v = _min;
    if (v > _max) v = _max;
    float span = _max - _min;
    float ratio = span > 0.0f ? (v - _min) / span : 0.0f;

    int16_t pad = theme.padding;
    int16_t trackH = (int16_t)(h * 35 / 100);
    if (trackH < 6) trackH = 6;
    int16_t ty = (int16_t)(y + (h - trackH) / 2);
    int16_t tw = (int16_t)(w - pad * 2);
    int16_t tx = (int16_t)(x + pad);
    g.fillRoundRect(tx, ty, tw, trackH, (int16_t)(trackH / 2), theme.surfaceEdge);
    if (!_transparentColor) {
        uint16_t fill = _hasColor ? _color : theme.primary;
        int16_t fw = (int16_t)(tw * ratio);
        if (fw > 0) g.fillRoundRect(tx, ty, fw, trackH, (int16_t)(trackH / 2), fill);
        int16_t knobR = (int16_t)(trackH + 2);
        if (knobR < 6) knobR = 6;
        int16_t kx = (int16_t)(tx + tw * ratio);
        int16_t ky = (int16_t)(ty + trackH / 2);
        g.fillCircle(kx, ky, knobR, fill);
        g.drawCircle(kx, ky, knobR, theme.text);
    }
}

}
