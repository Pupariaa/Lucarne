#ifndef LUCARNE_BATTERY_H
#define LUCARNE_BATTERY_H

#include "../LucarneWidget.h"

namespace lucarne {

class Battery : public Widget {
  public:
    Battery(int16_t x, int16_t y, int16_t w, int16_t h, const char *levelKey, bool showPercent = true);

    void setShowPercent(bool show) { markDirty(); _showPercent = show; }
    void setChargingKey(const char *key) { markDirty(); _chargingKey = key; }
    void setLowThreshold(uint8_t pct) { markDirty(); _lowPct = pct; }

    uint8_t storeKeys(const char **out, uint8_t max) const override {
        return appendKey(out, appendKey(out, 0, max, _levelKey), max, _chargingKey);
    }
    void draw(Gfx &g, const Theme &theme, Store &store) override;

  private:
    const char *_levelKey;
    const char *_chargingKey;
    bool _showPercent;
    uint8_t _lowPct;
};

}

#endif
