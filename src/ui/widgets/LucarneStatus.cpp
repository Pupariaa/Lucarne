#include "LucarneStatus.h"

namespace lucarne {

Status::Status(int16_t x, int16_t y, int16_t w, int16_t h, const char *wifiKey, const char *rssiKey,
               const char *bluetoothKey)
    : Widget(x, y, w, h), _wifiKey(wifiKey), _rssiKey(rssiKey), _bluetoothKey(bluetoothKey) {}

void Status::drawWifiBars(Gfx &g, int16_t x, int16_t y, int16_t h, int16_t bars, uint16_t color) {
    int16_t barW = 3;
    int16_t gap = 2;
    for (int16_t i = 0; i < 4; i++) {
        int16_t bh = (int16_t)(h * (i + 1) / 4);
        if (bh < 2) bh = 2;
        int16_t bx = (int16_t)(x + i * (barW + gap));
        int16_t by = (int16_t)(y + h - bh);
        if (i < bars) {
            g.fillRect(bx, by, barW, bh, color);
        } else {
            g.drawRect(bx, by, barW, bh, color);
        }
    }
}

void Status::drawBluetooth(Gfx &g, int16_t x, int16_t y, int16_t size, uint16_t color) {
    int16_t cx = (int16_t)(x + size / 2);
    int16_t cy = (int16_t)(y + size / 2);
    int16_t r = (int16_t)(size / 2);
    if (r < 3) r = 3;
    g.drawLine(cx, (int16_t)(cy - r), cx, (int16_t)(cy + r), color);
    g.drawLine(cx, (int16_t)(cy - r), (int16_t)(cx + r), cy, color);
    g.drawLine(cx, (int16_t)(cy + r), (int16_t)(cx + r), cy, color);
    g.drawLine((int16_t)(cx - r / 2), (int16_t)(cy - r / 2), (int16_t)(cx + r / 2), (int16_t)(cy + r / 2),
               color);
    g.drawLine((int16_t)(cx - r / 2), (int16_t)(cy + r / 2), (int16_t)(cx + r / 2), (int16_t)(cy - r / 2),
               color);
}

void Status::draw(Gfx &g, const Theme &theme, Store &store) {
    int16_t cx = x;
    int16_t iconH = (int16_t)(h * 70 / 100);
    if (iconH < 8) iconH = 8;
    int16_t cy = (int16_t)(y + (h - iconH) / 2);
    uint16_t active = theme.text;
    uint16_t dim = theme.textDim;

    if (_wifiKey) {
        bool on = store.getBool(_wifiKey, false);
        int16_t bars = 0;
        if (on) {
            long rssi = _rssiKey ? store.getInt(_rssiKey, -70) : -70;
            if (rssi >= -50) bars = 4;
            else if (rssi >= -60) bars = 3;
            else if (rssi >= -70) bars = 2;
            else bars = 1;
        }
        drawWifiBars(g, cx, cy, iconH, bars, on ? active : dim);
        cx = (int16_t)(cx + 4 * 5 + 6);
    }

    if (_bluetoothKey) {
        bool bt = store.getBool(_bluetoothKey, false);
        drawBluetooth(g, cx, cy, iconH, bt ? active : dim);
    }
}

}
