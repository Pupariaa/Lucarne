#ifndef LUCARNE_SWITCH_H
#define LUCARNE_SWITCH_H

#include "../LucarneWidget.h"

namespace lucarne {

class Switch : public Widget {
  public:
    Switch(int16_t x, int16_t y, int16_t w, int16_t h, const char *label, const char *key);

    void setLabel(const char *label) { markDirty(); _label = label; }
    void setKey(const char *key) { markDirty(); _key = key; }
    void setTextFont(const AAFont *font);
    void setTextColor(uint16_t color);
    void setTextTransparent(bool transparent);
    void setTextSize(uint8_t size);
    void setTextSpacing(int8_t spacing);
    void toggle(Store &store);
    const char *key() const { return _key; }
    void setFocused(bool focused) {
        if (_focused == focused) return;
        _focused = focused;
        markDirty();
    }
    bool focused() const { return _focused; }

    Switch *asSwitch() override { return this; }
    uint8_t storeKeys(const char **out, uint8_t max) const override { return appendKey(out, 0, max, _key); }
    void draw(Gfx &g, const Theme &theme, Store &store) override;

  private:
    const char *_label;
    const char *_key;
    TextStyle _textStyle;
    bool _focused;
};

}

#endif
