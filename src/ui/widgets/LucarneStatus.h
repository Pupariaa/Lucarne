#ifndef LUCARNE_STATUS_H
#define LUCARNE_STATUS_H

#include "../LucarneWidget.h"

namespace lucarne {

class Status : public Widget {
  public:
    Status(int16_t x, int16_t y, int16_t w, int16_t h, const char *wifiKey = nullptr,
           const char *rssiKey = nullptr, const char *bluetoothKey = nullptr);

    uint8_t storeKeys(const char **out, uint8_t max) const override {
        uint8_t n = appendKey(out, 0, max, _wifiKey);
        n = appendKey(out, n, max, _rssiKey);
        return appendKey(out, n, max, _bluetoothKey);
    }
    void draw(Gfx &g, const Theme &theme, Store &store) override;

  private:
    const char *_wifiKey;
    const char *_rssiKey;
    const char *_bluetoothKey;

    static void drawWifiBars(Gfx &g, int16_t x, int16_t y, int16_t h, int16_t bars, uint16_t color);
    static void drawBluetooth(Gfx &g, int16_t x, int16_t y, int16_t size, uint16_t color);
};

}

#endif
