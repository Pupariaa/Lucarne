#ifndef LUCARNE_DATE_H
#define LUCARNE_DATE_H

#include "../LucarneWidget.h"
#include "../../core/LucarneTypes.h"

namespace lucarne {

class Date : public Widget {
  public:
    Date(int16_t x, int16_t y, int16_t w, int16_t h, const char *dayKey, const char *monthKey,
         const char *yearKey, DateFormat format = DateFormat::DmySlash);

    void setDateKey(const char *key) { markDirty(); _dateKey = key; }
    void setFormat(DateFormat format) { markDirty(); _format = format; }
    void setTextStyle(const TextStyle &style) { markDirty(); _textStyle = style; _hasTextStyle = true; }

    uint8_t storeKeys(const char **out, uint8_t max) const override {
        uint8_t n = appendKey(out, 0, max, _dateKey);
        n = appendKey(out, n, max, _dayKey);
        n = appendKey(out, n, max, _monthKey);
        return appendKey(out, n, max, _yearKey);
    }
    void draw(Gfx &g, const Theme &theme, Store &store) override;

  private:
    const char *_dateKey;
    const char *_dayKey;
    const char *_monthKey;
    const char *_yearKey;
    DateFormat _format;
    TextStyle _textStyle;
    bool _hasTextStyle;
};

}

#endif
