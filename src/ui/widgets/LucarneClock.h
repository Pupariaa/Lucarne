#ifndef LUCARNE_CLOCK_H
#define LUCARNE_CLOCK_H

#include "../LucarneWidget.h"
#include "../../core/LucarneTypes.h"

namespace lucarne {

class Clock : public Widget {
  public:
    Clock(int16_t x, int16_t y, int16_t w, int16_t h, const char *hourKey, const char *minuteKey,
          const char *secondKey = nullptr, ClockFormat format = ClockFormat::Hm);

    void setTimeKey(const char *key) { markDirty(); _timeKey = key; }
    void setFormat(ClockFormat format) { markDirty(); _format = format; }
    void setTextStyle(const TextStyle &style) { markDirty(); _textStyle = style; _hasTextStyle = true; }

    uint8_t storeKeys(const char **out, uint8_t max) const override {
        uint8_t n = appendKey(out, 0, max, _timeKey);
        n = appendKey(out, n, max, _hourKey);
        n = appendKey(out, n, max, _minuteKey);
        return appendKey(out, n, max, _secondKey);
    }
    void draw(Gfx &g, const Theme &theme, Store &store) override;

  private:
    const char *_timeKey;
    const char *_hourKey;
    const char *_minuteKey;
    const char *_secondKey;
    ClockFormat _format;
    TextStyle _textStyle;
    bool _hasTextStyle;
};

}

#endif
