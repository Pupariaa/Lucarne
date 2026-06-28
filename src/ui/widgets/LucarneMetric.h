#ifndef LUCARNE_METRIC_H
#define LUCARNE_METRIC_H

#include "../LucarneWidget.h"

namespace lucarne {

class Metric : public Widget {
  public:
    Metric(int16_t x, int16_t y, int16_t w, int16_t h, const char *label, const char *key,
           const char *unit = "");

    void setDecimals(uint8_t decimals) { _decimals = decimals; }
    void setAccent(uint16_t color);
    void clearAccent();
    void setLabelFont(const AAFont *font);
    void setLabelColor(uint16_t color);
    void setLabelTransparent(bool transparent);
    void setLabelSize(uint8_t size);
    void setLabelSpacing(int8_t spacing);
    void setValueFont(const AAFont *font);
    void setValueColor(uint16_t color);
    void setValueTransparent(bool transparent);
    void setValueSize(uint8_t size);
    void setValueSpacing(int8_t spacing);

    void draw(Gfx &g, const Theme &theme, Store &store) override;

  private:
    void formatValue(const Store &store, char *out, uint8_t outLen) const;

    const char *_label;
    const char *_key;
    const char *_unit;
    uint8_t _decimals;
    uint16_t _accent;
    bool _hasAccent;
    TextStyle _labelStyle;
    TextStyle _valueStyle;
};

}

#endif
