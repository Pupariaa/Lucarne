#include "LucarneBattery.h"
#include <stdio.h>

namespace lucarne {

Battery::Battery(int16_t x, int16_t y, int16_t w, int16_t h, const char *levelKey, bool showPercent)
    : Widget(x, y, w, h), _levelKey(levelKey), _chargingKey(nullptr), _showPercent(showPercent),
      _lowPct(20) {}

void Battery::draw(Gfx &g, const Theme &theme, Store &store) {
    float level = _levelKey ? store.getFloat(_levelKey, 0.0f) : 0.0f;
    if (level < 0.0f) level = 0.0f;
    if (level > 100.0f) level = 100.0f;
    bool charging = _chargingKey && store.getBool(_chargingKey, false);

    int16_t tipW = (int16_t)(w / 8);
    if (tipW < 2) tipW = 2;
    if (tipW > 6) tipW = 6;
    int16_t bodyW = (int16_t)(w - tipW - 1);
    int16_t bodyH = (int16_t)(h * 55 / 100);
    if (bodyH < 6) bodyH = 6;
    int16_t bx = x;
    int16_t by = (int16_t)(y + (h - bodyH) / 2);
    int16_t tx = (int16_t)(x + bodyW + 1);
    int16_t ty = (int16_t)(by + bodyH / 4);
    int16_t th = (int16_t)(bodyH / 2);

    g.drawRoundRect(bx, by, bodyW, bodyH, 2, theme.text);
    g.fillRect(tx, ty, tipW, th, theme.text);

    int16_t inset = 2;
    int16_t innerW = (int16_t)(bodyW - inset * 2);
    int16_t innerH = (int16_t)(bodyH - inset * 2);
    int16_t fillW = (int16_t)((innerW * level) / 100.0f);
    if (fillW < 0) fillW = 0;
    if (fillW > innerW) fillW = innerW;

    uint16_t fill = theme.success;
    if (level <= (float)_lowPct) fill = theme.danger;
    else if (level <= 40.0f) fill = theme.warning;
    if (charging) fill = theme.primary;

    if (fillW > 0) {
        g.fillRect((int16_t)(bx + inset), (int16_t)(by + inset), fillW, innerH, fill);
    }

    if (_showPercent && w >= 36 && h >= 14) {
        char buf[8];
        snprintf(buf, sizeof(buf), "%d", (int)(level + 0.5f));
        drawText(g, theme, buf, x, y, w, h, TextAlign::Center, theme.text, 1, theme.background,
                 theme.font);
    }
}

}
