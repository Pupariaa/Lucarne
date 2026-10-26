#include "LucarneSlider.h"

namespace lucarne {

Slider::Slider(int16_t x, int16_t y, int16_t w, int16_t h, const char *key, float minV, float maxV)
    : Widget(x, y, w, h), _key(key), _min(minV), _max(maxV), _step(0.0f), _color(0), _hasColor(false),
      _transparentColor(false), _focused(false), _editing(false) {}

float Slider::step() const {
    if (_step > 0.0f) return _step;
    float span = _max - _min;
    float s = span / 20.0f;
    return s > 0.0f ? s : 1.0f;
}

void Slider::setColor(uint16_t c) {
    markDirty();
    _color = c;
    _hasColor = true;
    _transparentColor = false;
}

void Slider::clearColor() { markDirty(); _transparentColor = true; _hasColor = false; }

void Slider::adjust(Store &store, int direction) {
    if (!_key) return;
    float v = store.getFloat(_key, _min);
    v += (direction > 0 ? step() : -step());
    if (v < _min) v = _min;
    if (v > _max) v = _max;
    store.setFloat(_key, v);
    markDirty();
}

void Slider::setValueFromX(Store &store, int16_t px) {
    markDirty();
    if (!_key || w <= 0) return;
    float ratio = (float)(px - x) / (float)w;
    if (ratio < 0.0f) ratio = 0.0f;
    if (ratio > 1.0f) ratio = 1.0f;
    store.setFloat(_key, _min + ratio * (_max - _min));
}

Rect Slider::boundsLogical(Gfx &g, const Theme &theme) const {
    (void)g;
    int16_t trackH = (int16_t)(h * 35 / 100);
    if (trackH < 6) trackH = 6;
    int16_t knobR = (int16_t)(trackH + 2);
    if (knobR < 6) knobR = 6;
    int16_t reach = (int16_t)(knobR + 4);
    int16_t overY = (int16_t)(reach - h / 2);
    if (overY < 0) overY = 0;
    int16_t overX = (int16_t)(reach - theme.padding);
    if (overX < 0) overX = 0;
    return Rect((int16_t)(x - overX), (int16_t)(y - overY), (int16_t)(w + 2 * overX),
                (int16_t)(h + 2 * overY));
}

void Slider::draw(Gfx &g, const Theme &theme, Store &store) {
    float v = _key ? store.getFloat(_key, _min) : _min;
    if (v < _min) v = _min;
    if (v > _max) v = _max;
    float span = _max - _min;
    float ratio = span > 0.0f ? (v - _min) / span : 0.0f;
    if (g.isCharacterGrid()) {
        g.drawGridBar(x, y, w, h, ratio);
        return;
    }

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
        if (_editing) {
            g.fillCircle(kx, ky, (int16_t)(knobR + 3), theme.primary);
        }
        g.fillCircle(kx, ky, knobR, fill);
        g.drawCircle(kx, ky, knobR, _editing ? theme.primary : theme.text);
    }
    if (_focused) {
        g.drawRoundRect(x, y, w, h, 4, theme.primary);
        g.drawRoundRect((int16_t)(x + 1), (int16_t)(y + 1), (int16_t)(w - 2), (int16_t)(h - 2), 4,
                        theme.primary);
    }
}

}
